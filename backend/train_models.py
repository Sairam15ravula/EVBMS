from __future__ import annotations

import json
from pathlib import Path
import warnings

import joblib
import pandas as pd
from pandas.api.types import is_numeric_dtype
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, mean_absolute_error, r2_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier, XGBRegressor

warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "datasets"
MODEL_DIR = ROOT / "backend" / "models"
TEMPLATE_MODEL_DIR = ROOT / "backend" / "backend_template" / "models"

for path in [MODEL_DIR, TEMPLATE_MODEL_DIR]:
    path.mkdir(parents=True, exist_ok=True)


def save_model(model, filename: str) -> None:
    for folder in [MODEL_DIR, TEMPLATE_MODEL_DIR]:
        joblib.dump(model, folder / filename)


def save_training_report(report: dict) -> None:
    for folder in [MODEL_DIR, TEMPLATE_MODEL_DIR]:
        with open(folder / "training_report.json", "w", encoding="utf-8") as handle:
            json.dump(report, handle, indent=2)

    with open(MODEL_DIR / "metrics.json", "w", encoding="utf-8") as handle:
        json.dump(
            {
                "model_count": len(report) - 1,
                "summary": report.get("Notes", []),
            },
            handle,
            indent=2,
        )


# 1) SOH regression model
cycle_df = pd.read_csv(DATA_DIR / "battery_cycle_level.csv")
cycle_df["init_capacity"] = cycle_df.groupby("battery_id")["capacity"].transform("first")
soh_features = ["cycle", "voltage", "temperature", "capacity", "init_capacity"]
X_soh = cycle_df[soh_features]
y_soh = cycle_df["soh"]
soh_model = XGBRegressor(
    n_estimators=250,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    n_jobs=2,
)
soh_model.fit(X_soh, y_soh)
soh_pred = soh_model.predict(X_soh)
soh_metrics = {
    "mae": float(mean_absolute_error(y_soh, soh_pred)),
    "r2": float(r2_score(y_soh, soh_pred)),
}
save_model(soh_model, "soh_model_xgb.joblib")

# 2) RUL regression model
rul_features = ["cycle", "voltage", "temperature", "capacity", "soh", "init_capacity"]
X_rul = cycle_df[rul_features]
y_rul = cycle_df["rul"]
rul_model = XGBRegressor(
    n_estimators=250,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    n_jobs=2,
)
rul_model.fit(X_rul, y_rul)
rul_pred = rul_model.predict(X_rul)
rul_metrics = {
    "mae": float(mean_absolute_error(y_rul, rul_pred)),
    "r2": float(r2_score(y_rul, rul_pred)),
}
save_model(rul_model, "rul_model_xgb.joblib")

# 3) Charging duration classification model
charging_df = pd.read_csv(DATA_DIR / "ev_battery_charging_data.csv")
charge_target = "Optimal Charging Duration Class"
charge_features = [
    col for col in charging_df.columns if col != charge_target
]

numeric_features = [col for col in charge_features if is_numeric_dtype(charging_df[col])]
cat_features = [col for col in charge_features if not is_numeric_dtype(charging_df[col])]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "num",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]
            ),
            numeric_features,
        ),
        (
            "cat",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="most_frequent")),
                    ("onehot", OneHotEncoder(handle_unknown="ignore")),
                ]
            ),
            cat_features,
        ),
    ]
)
charging_model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        (
            "classifier",
            XGBClassifier(
                n_estimators=220,
                max_depth=4,
                learning_rate=0.15,
                subsample=0.9,
                colsample_bytree=0.9,
                random_state=42,
                n_jobs=2,
            ),
        ),
    ]
)
charging_model.fit(charging_df[charge_features], charging_df[charge_target])
charge_pred = charging_model.predict(charging_df[charge_features])
charge_metrics = {
    "accuracy": float(accuracy_score(charging_df[charge_target], charge_pred)),
    "f1_macro": float(f1_score(charging_df[charge_target], charge_pred, average="macro")),
}
save_model(charging_model, "charging_class_model_xgb.joblib")

# 4) Telemetry anomaly detection model
telemetry_df = pd.read_csv(DATA_DIR / "Part1(1).csv")
telemetry_df["timestamp"] = pd.to_datetime(telemetry_df["timestamp"], errors="coerce")
telemetry_df = telemetry_df.dropna(subset=["timestamp"]).copy()
telemetry_df["hour"] = telemetry_df["timestamp"].dt.hour
telemetry_df["dayofweek"] = telemetry_df["timestamp"].dt.dayofweek
telemetry_features = ["soc", "voltage", "current", "hour", "dayofweek"]
anomaly_model = Pipeline(
    steps=[
        ("scaler", StandardScaler()),
        ("isolation_forest", IsolationForest(contamination=0.01, random_state=42, n_estimators=200)),
    ]
)
anomaly_model.fit(telemetry_df[telemetry_features])
save_model(anomaly_model, "telemetry_anomaly_model.joblib")
save_model(Pipeline([("scaler", StandardScaler()), ("isolation_forest", IsolationForest(contamination=0.01, random_state=42, n_estimators=200))]), "telemetry_isolation_forest.joblib")

# 5) Capacity-fade regression model
capacity_df = pd.read_csv(DATA_DIR / "Part2.csv_Part_2.csv")
capacity_features = ["Cycle_Index"]
X_capacity = capacity_df[capacity_features]
y_capacity = capacity_df["Discharge_Capacity (Ah)"]
capacity_model = XGBRegressor(
    n_estimators=250,
    max_depth=4,
    learning_rate=0.1,
    subsample=0.9,
    colsample_bytree=0.9,
    random_state=42,
    n_jobs=2,
)
capacity_model.fit(X_capacity, y_capacity)
capacity_pred = capacity_model.predict(X_capacity)
capacity_metrics = {
    "mae": float(mean_absolute_error(y_capacity, capacity_pred)),
    "r2": float(r2_score(y_capacity, capacity_pred)),
}
save_model(capacity_model, "capacity_fade_model.joblib")

report = {
    "SOH_model": {
        "type": "XGBRegressor",
        "features": soh_features,
        **soh_metrics,
    },
    "RUL_model": {
        "type": "XGBRegressor",
        "features": rul_features,
        **rul_metrics,
    },
    "Charging_class_model": {
        "type": "XGBClassifier",
        "features": charge_features,
        **charge_metrics,
    },
    "Telemetry_anomaly_model": {
        "type": "IsolationForest+StandardScaler",
        "features": telemetry_features,
        "contamination": 0.01,
    },
    "Capacity_fade_model": {
        "type": "XGBRegressor",
        "features": capacity_features,
        **capacity_metrics,
    },
    "Notes": [
        "Models were retrained from the CSV files in the datasets folder.",
        "SOH and RUL use cycle-level battery data.",
        "Charging class uses the EV charging dataset with categorical encoding.",
        "Telemetry anomaly uses the telemetry time-series sample and unsupervised anomaly detection.",
    ],
}
save_training_report(report)

print("Training complete. Models saved to:")
print(MODEL_DIR)
print(TEMPLATE_MODEL_DIR)
print(json.dumps(report, indent=2))
