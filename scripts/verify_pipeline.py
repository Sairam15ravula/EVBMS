"""
Executable End-to-End Telemetry-to-ML System Pipeline Verification Runner.
Validates aggregated health status, EKF physics inference, ML model loader readiness,
independent physical safety rules, and grounded offline XAI analysis.
"""
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import json
from datetime import datetime

from backend.services.soc_ekf import ExtendedKalmanFilterSoC, validate_ekf_accuracy
from backend.services.model_loader import model_loader
from backend.services.anomaly import check_independent_safety_rules, predict_anomaly
from backend.services.xai_explainer import generate_grounded_xai_analysis


def run_e2e_verification():
    print("=" * 70)
    print("EV BATTERY INTELLIGENCE PLATFORM — E2E SYSTEM PIPELINE VERIFICATION")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 70)

    # Step 1: Model Loader Verification
    print("\n[STAGE 1/5] Checking ML Model Loader & Checksum Integrity...")
    status = model_loader.get_status()
    total_models = len(status)
    ready_count = sum(1 for is_ready in status.values() if is_ready)
    print(f" -> Models Registered: {total_models}")
    print(f" -> Models Ready (SHA256 Verified): {ready_count}/{total_models}")
    for model_name, is_ready in status.items():
        state_str = "READY" if is_ready else "FALLBACK"
        print(f"    • {model_name}: {state_str}")
    assert ready_count == total_models, "Not all ML models passed SHA256 verification!"

    # Step 2: Extended Kalman Filter Physics Engine
    print("\n[STAGE 2/5] Testing 1RC Extended Kalman Filter (EKF) SoC Estimator...")
    ekf = ExtendedKalmanFilterSoC(initial_soc=0.85, chemistry="NMC", nominal_capacity_ah=230.0)
    soc_est, v_rc, y_res = ekf.step(current_amps=30.0, measured_voltage_v=3.82)
    print(f" -> Initial SoC: 85.0% | Updated SoC: {soc_est:.2f}%")
    print(f" -> Polarization Voltage: {v_rc:.4f} V | Residual: {y_res:.4f} V")
    assert 0.0 <= soc_est <= 100.0, "EKF SoC estimate out of bounds!"

    # Step 3: EKF Accuracy Validation
    print("\n[STAGE 3/5] Validating EKF Accuracy Against Target (MAE <= 2.0%, RMSE <= 2.0%)...")
    true_socs = [90.0, 89.8, 89.6, 89.4, 89.2]
    currents = [20.0] * 5
    voltages = [3.90, 3.89, 3.88, 3.87, 3.86]
    metrics = validate_ekf_accuracy(currents, voltages, true_socs, chemistry="NMC")
    print(f" -> EKF MAE: {metrics['mae_pct']:.3f}% (Target <= 2.0%)")
    print(f" -> EKF RMSE: {metrics['rmse_pct']:.3f}% (Target <= 2.0%)")
    assert metrics["mae_pct"] <= 2.0, "EKF MAE exceeds 2.0% requirement!"

    # Step 4: Independent Physical Safety & Anomaly Engine
    print("\n[STAGE 4/5] Testing Independent Physical Safety & Isolation Forest Engine...")
    safety_violations = check_independent_safety_rules(
        soc=85.0, voltage=3.8, current=45.0, temperature=58.0, cell_delta_mv=65.0
    )
    print(f" -> Critical Thermal Warning (>55°C): {safety_violations['critical_thermal_warning']}")
    print(f" -> Cell Imbalance Warning (>50mV): {safety_violations['cell_voltage_imbalance_warning']}")
    assert safety_violations['critical_thermal_warning'] is True

    is_anomaly, proba, iso_flag, source = predict_anomaly(
        soc=85.0, voltage=3.8, current=45.0, hour=14, dayofweek=2, temperature=58.0
    )
    print(f" -> Final Combined Anomaly Flag: {is_anomaly} (Source: {source})")
    assert is_anomaly is True

    # Step 5: Grounded Offline XAI Degradation Analysis
    print("\n[STAGE 5/5] Testing Grounded XAI Degradation Explainer (Offline Fallback)...")
    xai_res = generate_grounded_xai_analysis(
        vehicle_info={"name": "Tesla Model 3 LR", "chemistry": "NMC"},
        telemetry_frame={"voltage": 370.0, "current": 45.0, "temperature": 32.0, "internalResistance": 14.5},
        health_metrics={"soh": 88.4, "rulYears": 6.2, "healthStatusText": "GOOD"},
        safety_violations=safety_violations
    )
    print(f" -> XAI Source: {xai_res['source']}")
    print(f" -> Health Diagnosis: {xai_res['aiAnalysis']['healthDiagnosis']}")
    print(" -> Action Recommendations:")
    for idx, act in enumerate(xai_res['aiAnalysis']['actionPlan'], 1):
        print(f"    {idx}. {act}")
    assert xai_res["success"] is True

    print("\n" + "=" * 70)
    print("SUCCESS: ALL 5 PIPELINE STAGES PASSED E2E VERIFICATION CLEANLY!")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(run_e2e_verification())
