"""
services/soh.py

Loads the trained SOH model and provides prediction functions.
"""

from pathlib import Path
# pyrefly: ignore [missing-import]
import joblib
# pyrefly: ignore [missing-import]
import numpy as np

# ---------------------------------------------------
# Model Path
# ---------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / "models" / "soh_model_xgb.joblib"

# ---------------------------------------------------
# Load Model (Loads only once when server starts)
# ---------------------------------------------------

try:
    soh_model = joblib.load(MODEL_PATH)
    print("✅ SOH model loaded successfully")
except Exception as e:
    soh_model = None
    print(f"❌ Failed to load SOH model: {e}")


# ---------------------------------------------------
# Prediction Function
# ---------------------------------------------------

def predict_soh(
    cycle: int,
    voltage: float,
    temperature: float,
    capacity: float,
    init_capacity: float,
):
    """
    Predict Battery State of Health (SOH)

    Parameters
    ----------
    cycle : Battery cycle count
    voltage : Battery voltage
    temperature : Battery temperature
    capacity : Current battery capacity
    init_capacity : Initial battery capacity

    Returns
    -------
    float
        Predicted SOH (%)
    """

    if soh_model is None:
        raise RuntimeError("SOH model is not loaded.")

    features = np.array(
        [[
            cycle,
            voltage,
            temperature,
            capacity,
            init_capacity
        ]]
    )

    prediction = soh_model.predict(features)

    return round(float(prediction[0]), 2)


# ---------------------------------------------------
# Batch Prediction
# ---------------------------------------------------

def predict_soh_batch(data):
    """
    Predict SOH for multiple batteries.

    Parameters
    ----------
    data : list of feature lists

    Example
    -------
    [
        [120, 398.4, 32.5, 69.2, 75],
        [450, 395.2, 35.8, 66.8, 75]
    ]
    """

    if soh_model is None:
        raise RuntimeError("SOH model is not loaded.")

    data = np.asarray(data)

    predictions = soh_model.predict(data)

    return predictions.tolist()


# ---------------------------------------------------
# Health Check
# ---------------------------------------------------

def model_loaded():
    """
    Returns True if model loaded successfully.
    """

    return soh_model is not None


# ---------------------------------------------------
# Test
# ---------------------------------------------------

if __name__ == "__main__":

    sample = {
        "cycle": 250,
        "voltage": 398.6,
        "temperature": 31.5,
        "capacity": 70.4,
        "init_capacity": 75.0,
    }

    try:
        soh = predict_soh(**sample)

        print("\n========== RESULT ==========")
        print(f"Predicted SOH : {soh:.2f}%")
        print("============================\n")

    except Exception as e:
        print(e)