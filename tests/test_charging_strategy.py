"""
Phase 4 Verification: Charging Strategy Recommendation Rules & Edge Cases Unit Tests.
Covers:
- Dual modes: 'protect_battery_life' vs 'need_range_soon'
- Physical edge cases: Hot pack, cold pack, low SoH, near-full SoC
- Chemistry adjustments: LFP cell balancing vs NMC 80% ceiling
- FastAPI REST endpoints: POST /predict/charging and POST /predict/all
"""
import pytest
from fastapi.testclient import TestClient

from backend.app import app
from backend.services.charging import recommend_charging_strategy, get_charging_recommendation

client = TestClient(app)


def test_protect_battery_life_nominal():
    """Verify nominal longevity mode enforces 20%-80% buffer and AC slow charging."""
    rec = recommend_charging_strategy(
        soh=93.0,
        soc=50.0,
        temperature=25.0,
        battery_type="NMC",
        priority_mode="protect_battery_life",
    )
    assert rec["priority_mode"] == "protect_battery_life"
    assert rec["target_soc_min"] == 20.0
    assert rec["target_soc_max"] == 80.0
    assert rec["suggested_charge_rate_kw"] == 11.0
    assert "AC Level 2" in rec["suggested_charge_type"]
    assert "20%–80%" in rec["reason"] or "Longevity" in rec["reason"]


def test_need_range_soon_nominal():
    """Verify nominal range mode provides high-rate DC fast charging up to 95% SoC."""
    rec = recommend_charging_strategy(
        soh=93.0,
        soc=30.0,
        temperature=25.0,
        battery_type="NMC",
        priority_mode="need_range_soon",
    )
    assert rec["priority_mode"] == "need_range_soon"
    assert rec["target_soc_max"] >= 95.0
    assert rec["suggested_charge_rate_kw"] >= 100.0
    assert "DC Fast" in rec["suggested_charge_type"]
    assert "Range Priority" in rec["reason"]


def test_hot_pack_thermal_throttling_edge_case():
    """Verify hot pack (>= 42°C) throttles charging power to <= 7.4 kW and caps target SoC."""
    # Even in need_range_soon mode, safety override must take precedence
    rec = recommend_charging_strategy(
        soh=90.0,
        soc=45.0,
        temperature=44.5,  # Hot pack
        battery_type="NMC",
        priority_mode="need_range_soon",
    )
    assert rec["suggested_charge_rate_kw"] <= 7.4
    assert rec["target_soc_max"] <= 80.0
    assert "HOT PACK OVERRIDE" in rec["reason"]
    assert "thermal runaway" in rec["reason"].lower()


def test_cold_pack_lithium_plating_edge_case():
    """Verify cold pack (< 5°C) disables fast charging to prevent metallic lithium plating."""
    rec = recommend_charging_strategy(
        soh=90.0,
        soc=40.0,
        temperature=1.5,  # Sub-zero / cold pack
        battery_type="NMC",
        priority_mode="need_range_soon",
    )
    assert rec["suggested_charge_rate_kw"] <= 7.4
    assert "COLD PACK OVERRIDE" in rec["reason"]
    assert "lithium dendrite plating" in rec["reason"].lower()


def test_low_soh_degraded_pack_edge_case():
    """Verify degraded pack (SoH < 80%) contracts daily window and caps high-power charging."""
    # In longevity mode
    rec_longevity = recommend_charging_strategy(
        soh=74.0,  # Below 80% EOL boundary
        soc=50.0,
        temperature=25.0,
        priority_mode="protect_battery_life",
    )
    assert rec_longevity["target_soc_max"] <= 75.0
    assert rec_longevity["suggested_charge_rate_kw"] <= 7.4
    assert "Low SoH" in rec_longevity["reason"]

    # In range mode
    rec_range = recommend_charging_strategy(
        soh=74.0,
        soc=50.0,
        temperature=25.0,
        priority_mode="need_range_soon",
    )
    assert rec_range["target_soc_max"] <= 85.0
    assert rec_range["suggested_charge_rate_kw"] <= 50.0
    assert "Degraded Pack" in rec_range["reason"]


def test_near_full_soc_trickle_saturation_edge_case():
    """Verify near-full pack (>= 95% SoC) tapers power to 2.3 kW trickle rate."""
    rec = recommend_charging_strategy(
        soh=92.0,
        soc=96.5,  # Near full
        temperature=26.0,
        priority_mode="need_range_soon",
    )
    assert rec["suggested_charge_rate_kw"] <= 2.3
    assert "Trickle" in rec["suggested_charge_type"]
    assert "Near-Full Pack" in rec["reason"]


def test_high_soc_longevity_disconnect_advice():
    """Verify pack at 88% SoC in longevity mode advises stopping charge."""
    rec = recommend_charging_strategy(
        soh=92.0,
        soc=88.0,
        temperature=24.0,
        priority_mode="protect_battery_life",
    )
    assert rec["suggested_charge_rate_kw"] <= 3.6
    assert "80% daily preservation ceiling" in rec["reason"]


def test_chemistry_specific_rules():
    """Verify LFP supports 100% target SoC for cell balancing while NMC is capped."""
    rec_lfp = recommend_charging_strategy(
        soh=92.0,
        soc=60.0,
        temperature=25.0,
        battery_type="LFP",
        priority_mode="need_range_soon",
    )
    assert rec_lfp["target_soc_max"] == 100.0
    assert "LFP" in rec_lfp["reason"]

    rec_nmc = recommend_charging_strategy(
        soh=92.0,
        soc=60.0,
        temperature=25.0,
        battery_type="NMC",
        priority_mode="protect_battery_life",
    )
    assert rec_nmc["target_soc_max"] == 80.0
    assert "NMC" in rec_nmc["reason"]


def test_charging_api_endpoint():
    """Verify POST /predict/charging returns full recommendation schema."""
    resp = client.post(
        "/predict/charging",
        json={
            "soc": 45.0,
            "soh": 89.5,
            "temperature": 27.0,
            "battery_type": "NMC",
            "priority_mode": "protect_battery_life",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "target_soc_min" in data
    assert "target_soc_max" in data
    assert "suggested_charge_rate_kw" in data
    assert "suggested_charge_type" in data
    assert "priority_mode" in data
    assert "reason" in data
    assert len(data["reason"]) > 20
    assert data["target_soc_window"] == [data["target_soc_min"], data["target_soc_max"]]


def test_all_predict_charging_endpoint():
    """Verify POST /predict/all with charging payload embeds full strategy recommendation."""
    resp = client.post(
        "/predict/all",
        json={
            "charging": {
                "soc": 35.0,
                "soh": 76.0,  # Low SoH edge case
                "temperature": 43.0,  # Hot pack edge case
                "priority_mode": "need_range_soon",
            }
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "charging" in data
    ch = data["charging"]
    assert ch["suggested_charge_rate_kw"] <= 7.4  # Hot pack thermal throttle
    assert "HOT PACK" in ch["reason"]
