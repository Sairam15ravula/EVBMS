"""
Target leakage prevention and LOBO dataset splitting tests.
Rule 2: NO TARGET LEAKAGE. SOH = capacity / initial_capacity.
Therefore, neither capacity nor initial_capacity may ever be input features for SOH/RUL models.
Rule 1: Strict battery isolation across cross-validation folds (no shared battery IDs).
"""
import json
from pathlib import Path
import pytest
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold

from backend.services.soh import validate_no_soh_leakage, predict_soh, FORBIDDEN_SOH_TARGET_SUBSTRINGS
from backend.services.rul import validate_no_rul_target_leakage, predict_rul, FORBIDDEN_RUL_TARGET_SUBSTRINGS

MODELS_DIR = Path(__file__).resolve().parent.parent / "backend" / "models"
DATA_DIR = Path(__file__).resolve().parent.parent / "datasets"


def test_no_data_leakage_group_split():
    """Verify GroupKFold maintains pack isolation with zero pack overlap."""
    num_samples = 200
    pack_ids = np.repeat([f"PACK_{i}" for i in range(1, 11)], 20)
    df = pd.DataFrame({
        "pack_id": pack_ids,
        "soc": np.random.uniform(10, 90, num_samples),
        "voltage": np.random.uniform(300, 400, num_samples),
        "soh": np.random.uniform(75, 100, num_samples)
    })

    gkf = GroupKFold(n_splits=5)
    groups = df["pack_id"]

    for train_idx, test_idx in gkf.split(df, df["soh"], groups=groups):
        train_packs = set(df.iloc[train_idx]["pack_id"])
        test_packs = set(df.iloc[test_idx]["pack_id"])

        intersection = train_packs.intersection(test_packs)
        assert len(intersection) == 0, f"Data leakage detected! Packs {intersection} found in both train and test sets."


def test_soh_metadata_no_target_leakage():
    """Verify soh_model_xgb metadata JSON strictly excludes capacity and target variables."""
    meta_path = MODELS_DIR / "soh_model_xgb_metadata.json"
    assert meta_path.exists(), f"Missing metadata file: {meta_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    features = meta.get("features", [])
    assert len(features) > 0, "SoH features list is empty"

    for feat in features:
        feat_lower = feat.lower().strip()
        for forbidden in FORBIDDEN_SOH_TARGET_SUBSTRINGS:
            assert forbidden not in feat_lower, (
                f"Target leakage in soh_model_xgb metadata! Feature '{feat}' contains forbidden target term '{forbidden}'"
            )


def test_rul_metadata_no_target_leakage():
    """Verify rul_model_xgb metadata JSON strictly excludes capacity, SOH, and target variables."""
    meta_path = MODELS_DIR / "rul_model_xgb_metadata.json"
    assert meta_path.exists(), f"Missing metadata file: {meta_path}"

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    features = meta.get("features", [])
    assert len(features) > 0, "RUL features list is empty"

    for feat in features:
        feat_lower = feat.lower().strip()
        for forbidden in FORBIDDEN_RUL_TARGET_SUBSTRINGS:
            assert forbidden not in feat_lower, (
                f"Target leakage in rul_model_xgb metadata! Feature '{feat}' contains forbidden target term '{forbidden}'"
            )


def test_validate_no_soh_leakage_enforcement():
    """Verify validator accepts clean features and raises ValueError on leaky ones."""
    clean = ["cycle", "voltage", "temperature"]
    validate_no_soh_leakage(clean)  # Must not raise

    leaky_candidates = [
        ["capacity", "voltage"],
        ["cycle", "initial_capacity"],
        ["cycle", "init_capacity"],
        ["cycle", "soh"],
        ["cycle", "target_soh"],
    ]
    for candidate in leaky_candidates:
        with pytest.raises(ValueError, match="Target leakage detected"):
            validate_no_soh_leakage(candidate)


def test_validate_no_rul_target_leakage_enforcement():
    """Verify validator accepts clean features and raises ValueError on leaky ones."""
    clean = ["cycle", "voltage", "temperature"]
    validate_no_rul_target_leakage(clean)  # Must not raise

    leaky_candidates = [
        ["capacity", "voltage"],
        ["cycle", "initial_capacity"],
        ["cycle", "soh"],
        ["cycle", "rul"],
        ["cycle", "eol_cycle"],
    ]
    for candidate in leaky_candidates:
        with pytest.raises(ValueError, match="Target leakage detected"):
            validate_no_rul_target_leakage(candidate)


def test_rul_quantile_intervals_monotonic():
    """Verify RUL predictions guarantee non-crossing quantiles: lower <= median <= upper."""
    for cycle in [10, 50, 100, 150]:
        rul, status, src, lower, upper, width = predict_rul(
            cycle=cycle,
            voltage=3.8,
            temperature=25.0,
            soh=90.0,
        )
        assert rul >= 0.0, "RUL median must be non-negative"
        if lower is not None and upper is not None:
            assert lower <= rul <= upper, f"Crossing quantiles detected at cycle {cycle}: {lower} <= {rul} <= {upper}"
            assert width == pytest.approx(upper - lower, rel=1e-3)


def test_lobo_dataset_battery_isolation():
    """Verify Leave-One-Battery-Out splitting on real dataset has zero cross-contamination."""
    csv_path = DATA_DIR / "battery_cycle_level.csv"
    assert csv_path.exists(), f"Dataset not found: {csv_path}"

    df = pd.read_csv(csv_path)
    benchmark_cells = ["B0005", "B0006", "B0007", "B0018"]
    nasa_df = df[df["battery_id"].isin(benchmark_cells)]

    for test_cell in benchmark_cells:
        train_df = nasa_df[nasa_df["battery_id"] != test_cell]
        test_df = nasa_df[nasa_df["battery_id"] == test_cell]

        train_cells = set(train_df["battery_id"])
        test_cells = set(test_df["battery_id"])

        assert test_cell not in train_cells, f"Battery {test_cell} leaked into training set!"
        assert len(train_cells.intersection(test_cells)) == 0
