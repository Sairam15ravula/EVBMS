"""
Model Retraining Script for EV Battery Intelligence Platform.
Implements cell-level grouping (prevents data leakage), Random Forest vs. XGBoost evaluation,
and sidecar metadata JSON generation with SHA256 checksums and pinned scikit-learn version.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any
import warnings

import joblib
import numpy as np
import pandas as pd
from pandas.api.types import is_numeric_dtype
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, OneHotEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = ROOT / "datasets"
MODEL_DIR = ROOT / "backend" / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)


def calculate_sha256(filepath: Path) -> str:
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def save_model_with_metadata(
    model_obj: Any,
    filename: str,
    algorithm: str,
    features: list[str],
    validation_metrics: dict[str, float],
    dataset_name: str = "NASA_B0005_CALCE",
) -> None:
    """Save model binary and generate sidecar metadata JSON with SHA256 hash and scikit-learn version."""
    model_path = MODEL_DIR / filename
    joblib.dump(model_obj, model_path)

    sha256 = calculate_sha256(model_path)
    meta_filename = f"{filename.replace('.joblib', '')}_metadata.json"
    meta_path = MODEL_DIR / meta_filename

    metadata = {
        "model_name": filename.replace(".joblib", ""),
        "version": "1.0.0",
        "algorithm": algorithm,
        "dataset": dataset_name,
        "feature_schema_version": "v1.0",
        "features": features,
        "training_timestamp": datetime.now(timezone.utc).isoformat(),
        "validation_metrics": validation_metrics,
        "sha256": sha256,
        "scikit_learn_version": sklearn.__version__,
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def run_training() -> None:
    print(f"Using scikit-learn version: {sklearn.__version__}")
    print("Loading battery cycle dataset...")
    cycle_df = pd.read_csv(DATA_DIR / "battery_cycle_level.csv")
    cycle_df["init_capacity"] = cycle_df.groupby("battery_id")["capacity"].transform("first")

    # 1) SOH Regression: Evaluate Random Forest vs XGBoost with Non-Leaky Features (Rule 2: No Target Leakage)
    soh_features = ["cycle", "voltage", "temperature"]
    X_soh = cycle_df[soh_features]
    y_soh = cycle_df["soh"]
    groups_soh = cycle_df["battery_id"]

    # Cell/pack-level Group Split to prevent telemetry data leakage
    gkf = GroupKFold(n_splits=5)
    train_idx, test_idx = next(gkf.split(X_soh, y_soh, groups_soh))
    X_soh_tr, X_soh_te = X_soh.iloc[train_idx], X_soh.iloc[test_idx]
    y_soh_tr, y_soh_te = y_soh.iloc[train_idx], y_soh.iloc[test_idx]

    rf_soh = RandomForestRegressor(n_estimators=150, max_depth=6, random_state=42, n_jobs=2)
    rf_soh.fit(X_soh_tr, y_soh_tr)
    rf_soh_pred = rf_soh.predict(X_soh_te)
    rf_soh_rmse = np.sqrt(mean_squared_error(y_soh_te, rf_soh_pred))

    xgb_soh = XGBRegressor(n_estimators=250, max_depth=4, learning_rate=0.08, random_state=42, n_jobs=2)
    xgb_soh.fit(X_soh_tr, y_soh_tr)
    xgb_soh_pred = xgb_soh.predict(X_soh_te)
    xgb_soh_rmse = np.sqrt(mean_squared_error(y_soh_te, xgb_soh_pred))

    if xgb_soh_rmse <= rf_soh_rmse:
        winning_soh_model = xgb_soh
        winning_soh_algo = "XGBRegressor"
        winning_soh_pred = xgb_soh_pred
    else:
        winning_soh_model = rf_soh
        winning_soh_algo = "RandomForestRegressor"
        winning_soh_pred = rf_soh_pred

    soh_metrics = {
        "mae": float(mean_absolute_error(y_soh_te, winning_soh_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_soh_te, winning_soh_pred))),
        "r2": float(r2_score(y_soh_te, winning_soh_pred)),
    }
    save_model_with_metadata(
        {"model": winning_soh_model, "features": soh_features},
        "soh_model_xgb.joblib",
        winning_soh_algo,
        soh_features,
        soh_metrics,
    )

    # 2) RUL Regression: Quantile Gradient Boosting with Non-Leaky Features (5th, 50th, 95th quantiles)
    rul_features = ["cycle", "voltage", "temperature"]
    X_rul = cycle_df[rul_features]
    y_rul = cycle_df["rul"]

    train_idx_r, test_idx_r = next(gkf.split(X_rul, y_rul, groups_soh))
    X_rul_tr, X_rul_te = X_rul.iloc[train_idx_r], X_rul.iloc[test_idx_r]
    y_rul_tr, y_rul_te = y_rul.iloc[train_idx_r], y_rul.iloc[test_idx_r]

    reg_q05 = GradientBoostingRegressor(loss="quantile", alpha=0.05, n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42)
    reg_q50 = GradientBoostingRegressor(loss="quantile", alpha=0.50, n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42)
    reg_q95 = GradientBoostingRegressor(loss="quantile", alpha=0.95, n_estimators=100, max_depth=4, learning_rate=0.05, random_state=42)

    reg_q05.fit(X_rul_tr, y_rul_tr)
    reg_q50.fit(X_rul_tr, y_rul_tr)
    reg_q95.fit(X_rul_tr, y_rul_tr)

    pred_q05 = reg_q05.predict(X_rul_te)
    pred_q50 = reg_q50.predict(X_rul_te)
    pred_q95 = reg_q95.predict(X_rul_te)

    lower = np.clip(np.minimum(pred_q05, pred_q50), 0.0, None)
    upper = np.clip(np.maximum(pred_q95, pred_q50), 0.0, None)
    coverage_90 = float(np.mean((y_rul_te >= lower) & (y_rul_te <= upper)))
    mean_width = float(np.mean(upper - lower))

    rul_metrics = {
        "mae": float(mean_absolute_error(y_rul_te, pred_q50)),
        "rmse": float(np.sqrt(mean_squared_error(y_rul_te, pred_q50))),
        "r2": float(r2_score(y_rul_te, pred_q50)),
        "interval_coverage_90": coverage_90,
        "mean_interval_width": mean_width,
    }

    rul_bundle = {
        "model": reg_q50,
        "regressor_lower": reg_q05,
        "regressor_median": reg_q50,
        "regressor_upper": reg_q95,
        "features": rul_features,
        "lower_quantile": 0.05,
        "upper_quantile": 0.95,
    }
    save_model_with_metadata(
        rul_bundle,
        "rul_model_xgb.joblib",
        "QuantileGradientBoostingRegressor",
        rul_features,
        rul_metrics,
    )

    # 3) Charging Duration Classification Model
    charging_df = pd.read_csv(DATA_DIR / "ev_battery_charging_data.csv")
    charging_df.columns = [
        col.replace(" (%)", "").replace(" (V)", "").replace(" (A)", "").replace(" (°C)", "").replace(" (min)", "").replace(" ", "_")
        for col in charging_df.columns
    ]
    charging_df.columns = [col.split("_Temp")[0] + "_Temp" if "_Temp" in col else col for col in charging_df.columns]

    charge_target = "Optimal_Charging_Duration_Class"
    charge_features = [col for col in charging_df.columns if col != charge_target]

    numeric_features = [col for col in charge_features if is_numeric_dtype(charging_df[col])]
    cat_features = [col for col in charge_features if not is_numeric_dtype(charging_df[col])]

    label_encoder = LabelEncoder()
    y_charge = label_encoder.fit_transform(charging_df[charge_target])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", Pipeline(steps=[("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())]), numeric_features),
            ("cat", Pipeline(steps=[("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), cat_features),
        ]
    )
    charging_model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", XGBClassifier(n_estimators=220, max_depth=4, learning_rate=0.15, random_state=42, n_jobs=2)),
        ]
    )
    X_charge_tr, X_charge_te, y_charge_tr, y_charge_te = train_test_split(
        charging_df[charge_features], y_charge, test_size=0.2, random_state=42, stratify=y_charge
    )
    charging_model.fit(X_charge_tr, y_charge_tr)
    charge_pred = charging_model.predict(X_charge_te)
    charge_metrics = {
        "accuracy": float(accuracy_score(y_charge_te, charge_pred)),
        "f1_macro": float(f1_score(y_charge_te, charge_pred, average="macro")),
    }
    save_model_with_metadata(
        {
            "pipeline": charging_model,
            "label_encoder": label_encoder,
            "num_features": numeric_features,
            "cat_features": cat_features,
            "features": charge_features,
        },
        "charging_class_model_xgb.joblib",
        "XGBClassifier",
        charge_features,
        charge_metrics,
    )

    # 4) Telemetry Anomaly Isolation Forest & XGBoost Classifier
    telemetry_df = pd.read_csv(DATA_DIR / "Part1(1).csv")
    telemetry_df["timestamp"] = pd.to_datetime(telemetry_df["timestamp"], errors="coerce")
    telemetry_df = telemetry_df.dropna(subset=["timestamp"]).copy()
    telemetry_df["hour"] = telemetry_df["timestamp"].dt.hour
    telemetry_df["dayofweek"] = telemetry_df["timestamp"].dt.dayofweek

    iso_features = ["soc", "voltage", "current"]
    iso_model = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("isolation_forest", IsolationForest(contamination=0.01, random_state=42, n_estimators=200)),
        ]
    )
    iso_model.fit(telemetry_df[iso_features])
    save_model_with_metadata(
        {"model": iso_model, "features": iso_features},
        "telemetry_isolation_forest.joblib",
        "IsolationForest",
        iso_features,
        {"contamination": 0.01},
    )

    telemetry_features = ["soc", "voltage", "current", "hour", "dayofweek"]
    iso_preds = iso_model.named_steps["isolation_forest"].predict(
        iso_model.named_steps["scaler"].transform(telemetry_df[iso_features])
    )
    is_anom_ground_truth = ((iso_preds == -1) | (telemetry_df["voltage"] < 10)).astype(int)

    X_anom_tr, X_anom_te, y_anom_tr, y_anom_te = train_test_split(
        telemetry_df[telemetry_features], is_anom_ground_truth, test_size=0.2, random_state=42, stratify=is_anom_ground_truth
    )

    anom_clf = Pipeline(
        steps=[
            ("scaler", StandardScaler()),
            ("classifier", XGBClassifier(n_estimators=100, max_depth=3, random_state=42)),
        ]
    )
    anom_clf.fit(X_anom_tr, y_anom_tr)
    anom_pred = anom_clf.predict(X_anom_te)
    anom_metrics = {
        "accuracy": float(accuracy_score(y_anom_te, anom_pred)),
        "f1": float(f1_score(y_anom_te, anom_pred)),
    }
    save_model_with_metadata(
        {"model": anom_clf, "features": telemetry_features},
        "telemetry_anomaly_model.joblib",
        "XGBClassifier",
        telemetry_features,
        anom_metrics,
    )

    # 5) Capacity Fade Model
    capacity_df = pd.read_csv(DATA_DIR / "Part2.csv_Part_2.csv")
    capacity_features = ["Cycle_Index"]
    X_capacity = capacity_df[capacity_features]
    y_capacity = capacity_df["Discharge_Capacity (Ah)"]

    X_cap_tr, X_cap_te, y_cap_tr, y_cap_te = train_test_split(X_capacity, y_capacity, test_size=0.2, random_state=42)
    capacity_model = XGBRegressor(n_estimators=250, max_depth=4, learning_rate=0.1, random_state=42, n_jobs=2)
    capacity_model.fit(X_cap_tr, y_cap_tr)
    capacity_pred = capacity_model.predict(X_cap_te)
    capacity_metrics = {
        "mae": float(mean_absolute_error(y_cap_te, capacity_pred)),
        "rmse": float(np.sqrt(mean_squared_error(y_cap_te, capacity_pred))),
        "r2": float(r2_score(y_cap_te, capacity_pred)),
    }
    save_model_with_metadata(
        {"model": capacity_model, "features": capacity_features},
        "capacity_fade_model.joblib",
        "XGBRegressor",
        capacity_features,
        capacity_metrics,
    )

    print("All models retrained successfully under scikit-learn", sklearn.__version__)
    print("Model binaries and metadata JSONs generated in:", MODEL_DIR)


if __name__ == "__main__":
    run_training()
