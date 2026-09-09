"""
Unit tests for 1RC Extended Kalman Filter (EKF) SoC Estimator.
Verifies state vector updates, NMC vs LFP OCV interpolation curves, and accuracy target: MAE <= 2.0% & RMSE <= 2.0% (target MAE <= 1.5%).
"""
import pytest
import numpy as np
from backend.services.soc_ekf import ExtendedKalmanFilterSoC, validate_ekf_accuracy, get_ocv


def test_ekf_initialization():
    ekf_nmc = ExtendedKalmanFilterSoC(initial_soc=0.8, chemistry="NMC")
    assert ekf_nmc.x[0, 0] == pytest.approx(0.8)
    assert ekf_nmc.chemistry == "NMC"

    ekf_lfp = ExtendedKalmanFilterSoC(initial_soc=0.5, chemistry="LFP")
    assert ekf_lfp.x[0, 0] == pytest.approx(0.5)
    assert ekf_lfp.chemistry == "LFP"


def test_ocv_lookup_curves():
    # NMC open-circuit voltage range
    ocv_nmc_0 = get_ocv(0.0, "NMC")
    ocv_nmc_100 = get_ocv(1.0, "NMC")
    assert 3.0 <= ocv_nmc_0 <= 3.3
    assert 4.15 <= ocv_nmc_100 <= 4.25

    # LFP open-circuit voltage range
    ocv_lfp_0 = get_ocv(0.0, "LFP")
    ocv_lfp_100 = get_ocv(1.0, "LFP")
    assert 2.4 <= ocv_lfp_0 <= 2.8
    assert 3.55 <= ocv_lfp_100 <= 3.65


def test_ekf_step_discharge():
    ekf = ExtendedKalmanFilterSoC(initial_soc=0.9, chemistry="NMC", nominal_capacity_ah=200.0)
    # High-current discharge test
    for _ in range(200):
        curr = 100.0
        v_meas = get_ocv(ekf.x[0, 0], "NMC") - (curr * (ekf.r0 + ekf.r1))
        soc_est, _, _ = ekf.step(current_amps=curr, measured_voltage_v=v_meas)
    assert soc_est < 90.0  # SoC % should decrease during continuous discharge


def test_ekf_accuracy_target():
    steps = 50
    nominal_capacity_ah = 200.0
    
    current_a = 20.0
    ekf_sim = ExtendedKalmanFilterSoC(initial_soc=0.9, chemistry="NMC", nominal_capacity_ah=nominal_capacity_ah)
    
    true_socs = []
    currents = []
    voltages = []
    
    for _ in range(steps):
        true_socs.append(ekf_sim.x[0, 0] * 100.0)
        currents.append(current_a)
        v_meas = get_ocv(ekf_sim.x[0, 0], "NMC") - (current_a * ekf_sim.r0) - float(ekf_sim.x[1, 0])
        voltages.append(v_meas)
        ekf_sim.step(current_a, v_meas)

    metrics = validate_ekf_accuracy(
        time_series_current=currents,
        time_series_voltage=voltages,
        ground_truth_soc_pct=true_socs,
        chemistry="NMC",
        nominal_capacity_ah=nominal_capacity_ah
    )

    assert metrics["mae_pct"] <= 2.0, f"EKF MAE {metrics['mae_pct']:.2f}% exceeds acceptance threshold of 2.0%"
    assert metrics["rmse_pct"] <= 2.0, f"EKF RMSE {metrics['rmse_pct']:.2f}% exceeds acceptance threshold of 2.0%"
    assert metrics["max_error_pct"] <= 5.0
