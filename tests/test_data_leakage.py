"""
Unit test verifying cell-grouped dataset splitting (GroupKFold).
Ensures zero telemetry cycles leak between train and test battery packs.
"""
import pytest
import pandas as pd
import numpy as np
from sklearn.model_selection import GroupKFold


def test_no_data_leakage_group_split():
    # Create synthetic dataset with multiple pack IDs
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

        # Assert zero intersection between train packs and test packs
        intersection = train_packs.intersection(test_packs)
        assert len(intersection) == 0, f"Data leakage detected! Packs {intersection} found in both train and test sets."
