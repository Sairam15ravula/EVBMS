"""
Trains PLACEHOLDER versions of all 6 models named in the PRD / tech-stack
docs, on the synthetic dataset from generate_synthetic_data.py, and saves
them to backend/models/ under the exact filenames the PRD specifies.

These are real, working, evaluated models — just trained on synthetic
data instead of the NASA Battery Aging Dataset / CALCE Battery Dataset.
Swap generate_synthetic_data.py for a loader over the real datasets and
re-run this script; nothing else in the backend needs to change, because
services/*.py only care about the input feature names and joblib
interface, not how the model was trained.

Run from backend/:  python training/train_all.py
"""
import json
import warnings
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, average_precision_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, LabelEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
import xgboost as xgb

try:
    from backend.training.generate_synthetic_data import build_datasets, EOL_THRESHOLD
except ImportError:
    from generate_synthetic_data import build_datasets, EOL_THRESHOLD

from pathlib import Path
warnings.filterwarnings("ignore")
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
metrics_report = {}


def compute_true_rul(telemetry: pd.DataFrame) -> pd.DataFrame:
    """Oracle RUL from each cell's full simulated trajectory (only possible
    because this is synthetic, run-to-failure data — exactly the property
    that makes NASA/CALCE usable for RUL training too)."""
    out = []
    for cell_id, g in telemetry.groupby("cell_id"):
        g = g.sort_values("cycle")
        below = g[g["soh"] <= EOL_THRESHOLD]
        if below.empty:
            continue  # this cell never reached EOL in its simulated horizon
        eol_cycle = below["cycle"].iloc[0]
        g = g[g["cycle"] < eol_cycle].copy()
        g["rul"] = eol_cycle - g["cycle"]
        out.append(g)
    return pd.concat(out, ignore_index=True) if out else telemetry.iloc[0:0]


def train_soh(telemetry):
    features = ["cycle", "voltage", "temperature", "capacity", "init_capacity"]
    X, y = telemetry[features], telemetry["soh"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    model = xgb.XGBRegressor(n_estimators=250, max_depth=5, learning_rate=0.06, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    metrics_report["soh"] = {
        "features": features,
        "mae": round(mean_absolute_error(y_te, pred), 3),
        "rmse": round(mean_squared_error(y_te, pred) ** 0.5, 3),
        "r2": round(r2_score(y_te, pred), 4),
    }
    joblib.dump({"model": model, "features": features}, f"{MODELS_DIR}/soh_model_xgb.joblib")
    print("SOH  ", metrics_report["soh"])
    return model


def train_rul(telemetry):
    rul_df = compute_true_rul(telemetry)
    features = ["cycle", "voltage", "temperature", "capacity", "soh", "init_capacity"]
    X, y = rul_df[features], rul_df["rul"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    model = xgb.XGBRegressor(n_estimators=300, max_depth=6, learning_rate=0.06, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    metrics_report["rul"] = {
        "features": features,
        "rows_used": int(len(rul_df)),
        "mae_cycles": round(mean_absolute_error(y_te, pred), 1),
        "rmse_cycles": round(mean_squared_error(y_te, pred) ** 0.5, 1),
        "r2": round(r2_score(y_te, pred), 4),
    }
    joblib.dump({"model": model, "features": features}, f"{MODELS_DIR}/rul_model_xgb.joblib")
    print("RUL  ", metrics_report["rul"])
    return model


def train_anomaly_classifier(telemetry):
    features = ["soc", "voltage", "current", "hour", "dayofweek"]
    X, y = telemetry[features], telemetry["is_anomaly"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    model = xgb.XGBClassifier(n_estimators=200, max_depth=4, learning_rate=0.08,
                               random_state=42, scale_pos_weight=max(1, (y_tr == 0).sum() / max(1, (y_tr == 1).sum())))
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    proba = model.predict_proba(X_te)[:, 1]
    metrics_report["telemetry_anomaly"] = {
        "features": features,
        "positive_rate_in_data": round(float(y.mean()), 4),
        "accuracy": round(accuracy_score(y_te, pred), 4),
        "precision_at_0.5": round(precision_score(y_te, pred, zero_division=0), 4),
        "recall_at_0.5": round(recall_score(y_te, pred, zero_division=0), 4),
        "f1_at_0.5": round(f1_score(y_te, pred, zero_division=0), 4),
        "roc_auc": round(roc_auc_score(y_te, proba), 4),
        "pr_auc": round(average_precision_score(y_te, proba), 4),
        "note": ("Anomalies are rare (~1-2% of rows) and this endpoint's inputs are "
                 "limited to soc/voltage/current/hour/dayofweek per the PRD spec — they "
                 "don't include temperature or resistance, which is what actually drives "
                 "the injected incidents in the synthetic data. Precision/recall at the "
                 "default 0.5 threshold are weak as a result; ROC-AUC/PR-AUC are the more "
                 "honest read on this model, and it's meant to complement the Isolation "
                 "Forest below, not replace it. Worth revisiting this endpoint's feature "
                 "list once real telemetry is available."),
    }
    joblib.dump({"model": model, "features": features}, f"{MODELS_DIR}/telemetry_anomaly_model.joblib")
    print("ANOM ", metrics_report["telemetry_anomaly"])
    return model


def train_isolation_forest(telemetry):
    features = ["voltage", "current", "temperature", "resistance", "soc"]
    X = telemetry[features]
    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    model.fit(X)
    pred = model.predict(X)  # -1 outlier, 1 inlier
    flagged_rate = float((pred == -1).mean())
    # sanity check only: unsupervised models don't train on is_anomaly, but since
    # this is synthetic data we happen to know it, so use it to eyeball recall
    recall_vs_injected = float(((pred == -1) & (telemetry["is_anomaly"] == 1)).sum() / max(1, (telemetry["is_anomaly"] == 1).sum()))
    metrics_report["telemetry_isolation_forest"] = {
        "features": features,
        "contamination_param": 0.05,
        "flagged_rate": round(flagged_rate, 4),
        "recall_vs_injected_incidents_sanity_check": round(recall_vs_injected, 4),
        "note": "Unsupervised — trained without labels, as intended. The recall figure above is only possible here because the synthetic labels are known; treat it as a sanity check, not a real evaluation metric, once you're on real data.",
    }
    joblib.dump({"model": model, "features": features}, f"{MODELS_DIR}/telemetry_isolation_forest.joblib")
    print("ISOF ", metrics_report["telemetry_isolation_forest"])
    return model


def train_capacity_fade(telemetry):
    features = ["Cycle_Index"]
    df = telemetry.rename(columns={"cycle": "Cycle_Index"})
    X, y = df[features], df["capacity"]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42)
    model = xgb.XGBRegressor(n_estimators=150, max_depth=4, learning_rate=0.08, random_state=42)
    model.fit(X_tr, y_tr)
    pred = model.predict(X_te)
    metrics_report["capacity_fade"] = {
        "features": features,
        "mae_kwh": round(mean_absolute_error(y_te, pred), 3),
        "r2": round(r2_score(y_te, pred), 4),
        "note": "Single-feature population trend (cycle only) — much coarser than the SoH model on purpose, matching the PRD's minimal input spec for this endpoint.",
    }
    joblib.dump({"model": model, "features": features}, f"{MODELS_DIR}/capacity_fade_model.joblib")
    print("CAP  ", metrics_report["capacity_fade"])
    return model


def train_charging_classifier(charging):
    num_features = ["SOC", "Voltage", "Current", "Battery_Temp", "Ambient_Temp",
                     "Charging_Duration", "Degradation_Rate", "Efficiency", "Charging_Cycles"]
    cat_features = ["Charging_Mode", "Battery_Type", "EV_Model"]
    X = charging[num_features + cat_features]
    label_encoder = LabelEncoder()
    y = label_encoder.fit_transform(charging["label"])

    pre = ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_features),
    ], remainder="passthrough")

    pipe = Pipeline([
        ("pre", pre),
        ("clf", xgb.XGBClassifier(n_estimators=250, max_depth=6, learning_rate=0.08,
                                   random_state=42, num_class=len(label_encoder.classes_),
                                   objective="multi:softprob")),
    ])
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    pipe.fit(X_tr, y_tr)
    pred = pipe.predict(X_te)
    metrics_report["charging_class"] = {
        "num_features": num_features, "cat_features": cat_features,
        "classes": label_encoder.classes_.tolist(),
        "accuracy": round(accuracy_score(y_te, pred), 4),
        "f1_macro": round(f1_score(y_te, pred, average="macro"), 4),
    }
    # persist the pipeline (which owns the encoder) AND the label encoder together,
    # directly addressing the PRD's "categorical encoding mismatch" risk (section 13)
    joblib.dump({"pipeline": pipe, "label_encoder": label_encoder,
                 "num_features": num_features, "cat_features": cat_features},
                f"{MODELS_DIR}/charging_class_model_xgb.joblib")
    print("CHRG ", metrics_report["charging_class"])
    return pipe


if __name__ == "__main__":
    print("Generating synthetic training data...")
    telemetry, charging = build_datasets(n_cells=70, seed=42)
    print(f"telemetry rows: {len(telemetry)}  |  charging rows: {len(charging)}\n")

    train_soh(telemetry)
    train_rul(telemetry)
    train_anomaly_classifier(telemetry)
    train_isolation_forest(telemetry)
    train_capacity_fade(telemetry)
    train_charging_classifier(charging)

    with open(f"{MODELS_DIR}/metrics_report.json", "w") as f:
        json.dump(metrics_report, f, indent=2)
    print("\nSaved 6 models + metrics_report.json to backend/models/")
