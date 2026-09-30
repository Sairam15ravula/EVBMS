"""
Extended Kalman Filter (EKF) State of Charge (SoC) Physics Estimator with 1RC Equivalent Circuit Model.
"""
from typing import Dict, List, Optional, Tuple, Union
import numpy as np

# Open Circuit Voltage (OCV) vs State of Charge (SoC: 0.0 - 1.0) Lookup Curves
OCV_SOC_CURVES: Dict[str, Dict[str, np.ndarray]] = {
    "NMC": {
        "soc": np.array([0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]),
        "ocv": np.array([3.00, 3.45, 3.62, 3.71, 3.78, 3.84, 3.92, 4.01, 4.09, 4.15, 4.20]),
    },
    "LFP": {
        "soc": np.array([0.0, 0.05, 0.1, 0.2, 0.5, 0.8, 0.9, 0.95, 1.0]),
        "ocv": np.array([2.50, 3.00, 3.18, 3.22, 3.28, 3.32, 3.35, 3.40, 3.65]),
    },
}


def get_ocv(soc: float, chemistry: str) -> float:
    """Interpolate Open Circuit Voltage (OCV) from SoC for specific chemistry."""
    curve = OCV_SOC_CURVES.get(chemistry.upper())
    if not curve:
        raise ValueError(f"Unsupported battery chemistry '{chemistry}'. Supported: 'NMC', 'LFP'")
    return float(np.interp(np.clip(soc, 0.0, 1.0), curve["soc"], curve["ocv"]))


def get_docv_dsoc(soc: float, chemistry: str) -> float:
    """Numerical derivative of OCV with respect to SoC: d(OCV)/d(SoC)."""
    eps = 1e-4
    v2 = get_ocv(min(1.0, soc + eps), chemistry)
    v1 = get_ocv(max(0.0, soc - eps), chemistry)
    return (v2 - v1) / (2 * eps)


class ExtendedKalmanFilterSoC:
    """
    1RC Equivalent Circuit Model (ECM) Extended Kalman Filter for SoC Estimation.

    State Vector: x_k = [z_k, v_rc_k]^T
      - z_k: State of Charge (0.0 to 1.0)
      - v_rc_k: Polarization RC voltage (V)

    Sign Convention:
      - Discharge Current: I_k > 0
      - Charge Current:    I_k < 0
    """

    def __init__(
        self,
        chemistry: str,
        nominal_capacity_ah: float = 200.0,
        r0_ohm: float = 0.015,
        r1_ohm: float = 0.010,
        c1_farad: float = 2000.0,
        dt_seconds: float = 1.0,
        initial_soc: float = 0.80,
        num_cells_series: Optional[int] = None,
    ):
        if chemistry.upper() not in OCV_SOC_CURVES:
            raise ValueError(f"Explicit chemistry must be specified ('NMC' or 'LFP'). Got: '{chemistry}'")

        self.chemistry = chemistry.upper()
        self.num_cells_series = num_cells_series
        self.q_max_coulombs = max(1e-3, nominal_capacity_ah) * 3600.0  # Ah to Ampere-seconds
        self.r0 = r0_ohm
        self.r1 = r1_ohm
        self.c1 = c1_farad
        self.tau = max(1e-4, r1_ohm * c1_farad)
        self.dt = max(1e-4, dt_seconds)

        # State vector: [z, v_rc]
        self.x = np.array([[np.clip(initial_soc, 0.0, 1.0)], [0.0]], dtype=float)

        # State Covariance P
        self.P = np.diag([1e-4, 1e-4])

        # Process Noise Covariance Q
        self.Q = np.diag([1e-7, 1e-5])

        # Measurement Noise Covariance R
        self.R = np.array([[1e-3]])

    def step(self, current_amps: float, measured_voltage_v: float) -> Tuple[float, float, float]:
        """
        Execute one EKF predict-update step.
        Auto-normalizes pack voltage if measured_voltage_v > 10.0 V.
        Returns (estimated_soc_pct, polarization_voltage_v, innovation_residual_v).
        """
        dt = self.dt
        eta = 0.98 if current_amps < 0 else 1.0  # Coulombic efficiency

        # Normalize pack voltage to single-cell equivalent if pack voltage was passed
        if measured_voltage_v > 10.0:
            if self.num_cells_series is not None and self.num_cells_series > 0:
                v_cell = measured_voltage_v / self.num_cells_series
            else:
                nominal_cell = 3.2 if self.chemistry == "LFP" else 3.7
                inferred_cells = max(1, round(measured_voltage_v / nominal_cell))
                v_cell = measured_voltage_v / inferred_cells
        else:
            v_cell = measured_voltage_v

        # --- 1. Predict Step ---
        soc_prev = float(self.x[0, 0])
        v_rc_prev = float(self.x[1, 0])

        # State Prediction
        soc_pred = soc_prev - (eta * current_amps * dt) / self.q_max_coulombs
        soc_pred = float(np.clip(soc_pred, 0.0, 1.0))
        v_rc_pred = np.exp(-dt / self.tau) * v_rc_prev + self.r1 * (1 - np.exp(-dt / self.tau)) * current_amps

        self.x[0, 0] = soc_pred
        self.x[1, 0] = v_rc_pred

        # State Transition Matrix F
        F = np.array([[1.0, 0.0], [0.0, np.exp(-dt / self.tau)]])

        # Covariance Prediction
        self.P = F @ self.P @ F.T + self.Q

        # --- 2. Update Step ---
        ocv_pred = get_ocv(soc_pred, self.chemistry)
        v_pred = ocv_pred - current_amps * self.r0 - v_rc_pred

        # Innovation Residual y (computed on normalized cell basis)
        y = v_cell - v_pred

        # Measurement Matrix H = [d(OCV)/d(SoC), -1]
        docv_dz = get_docv_dsoc(soc_pred, self.chemistry)
        H = np.array([[docv_dz, -1.0]])

        # Innovation Covariance S
        S = H @ self.P @ H.T + self.R

        # Kalman Gain K
        K = self.P @ H.T @ np.linalg.inv(S)

        # State Update
        self.x = self.x + K * y
        self.x[0, 0] = float(np.clip(self.x[0, 0], 0.0, 1.0))

        # Covariance Update
        I_mat = np.eye(2)
        self.P = (I_mat - K @ H) @ self.P

        estimated_soc_pct = float(self.x[0, 0] * 100.0)
        return estimated_soc_pct, float(self.x[1, 0]), float(y)


# Session-based EKF in-memory state tracking to maintain continuity across API calls
_EKF_SESSION_CACHE: Dict[str, ExtendedKalmanFilterSoC] = {}


def get_or_create_ekf(
    session_id: Optional[str],
    chemistry: str,
    nominal_capacity_ah: float = 200.0,
    dt_seconds: float = 1.0,
    initial_soc: float = 0.80,
    num_cells_series: Optional[int] = None,
) -> Tuple[ExtendedKalmanFilterSoC, str]:
    import uuid
    sid = session_id or str(uuid.uuid4())
    if sid in _EKF_SESSION_CACHE:
        ekf = _EKF_SESSION_CACHE[sid]
        if ekf.chemistry == chemistry.upper():
            return ekf, sid
    ekf = ExtendedKalmanFilterSoC(
        chemistry=chemistry,
        nominal_capacity_ah=nominal_capacity_ah,
        dt_seconds=dt_seconds,
        initial_soc=initial_soc,
        num_cells_series=num_cells_series,
    )
    _EKF_SESSION_CACHE[sid] = ekf
    return ekf, sid


def validate_ekf_accuracy(
    time_series_current: List[float],
    time_series_voltage: List[float],
    ground_truth_soc_pct: List[float],
    chemistry: str = "NMC",
    nominal_capacity_ah: float = 200.0,
) -> Dict[str, float]:
    """
    Validate EKF SoC estimation accuracy against ground truth telemetry.
    Calculates MAE, RMSE, and Max Absolute Error.
    """
    ekf = ExtendedKalmanFilterSoC(
        chemistry=chemistry,
        nominal_capacity_ah=nominal_capacity_ah,
        initial_soc=ground_truth_soc_pct[0] / 100.0,
    )

    estimated_socs = []
    for i, curr in enumerate(time_series_current):
        v_meas = time_series_voltage[i]
        soc_est, _, _ = ekf.step(curr, v_meas)
        estimated_socs.append(soc_est)

    errors = np.abs(np.array(estimated_socs) - np.array(ground_truth_soc_pct))
    mae = float(np.mean(errors))
    rmse = float(np.sqrt(np.mean(errors**2)))
    max_err = float(np.max(errors))

    return {
        "mae_pct": mae,
        "rmse_pct": rmse,
        "max_error_pct": max_err,
        "target_met": rmse < 2.0,
    }
