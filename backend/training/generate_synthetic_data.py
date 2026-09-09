"""
Synthetic battery-aging dataset generator.

This is NOT the NASA Battery Aging Dataset or the CALCE Battery Dataset.
It generates data that follows the same well-documented Li-ion aging
pattern those datasets show (near-linear fade, then an accelerating
"knee point"; internal resistance rising with fade; temperature and
fast-charge frequency as degradation drivers) across many synthetic
cells, so the placeholder models below have something real to train on.

Swap this out for a script that loads and feature-engineers the actual
NASA/CALCE CSV/.mat files and the rest of the pipeline (train_*.py)
does not need to change — only this file does.
"""
import numpy as np
import pandas as pd

RATED_CAPACITY = 75.0  # kWh, nominal pack rating
EOL_THRESHOLD = 80.0   # % SoH


def _knee_shape(x, knee_cycle, cycles):
    x = np.asarray(x, dtype=float)
    pre = x / knee_cycle
    # clamp to 0 before the fractional power: negative bases here only occur
    # where x <= knee_cycle, and that branch is discarded by np.where below,
    # so this only avoids a spurious NaN warning, not a real value.
    post_base = np.maximum(x - knee_cycle, 0) / max(1, cycles - knee_cycle)
    post = 1 + post_base ** 1.6 * 1.86
    return np.where(x <= knee_cycle, pre, post)


def generate_cell(rng, cell_id):
    cycles = int(rng.integers(60, 260))
    knee_frac = float(rng.uniform(0.45, 1.6))
    end_soh = float(rng.uniform(60, 98))
    temp_base = float(rng.uniform(22, 38))
    temp_noise = float(rng.uniform(2, 6.5))
    fast_charge_freq = float(np.clip(rng.uniform(-0.1, 0.75), 0, 1))

    knee_cycle = cycles * knee_frac
    c = np.arange(1, cycles + 1)
    total_fade = 1 - end_soh / 100
    shape = _knee_shape(c, knee_cycle, cycles)
    shape_end = _knee_shape(np.array([cycles]), knee_cycle, cycles)[0]
    fade_frac = total_fade * (shape / shape_end)

    noise = (rng.random(cycles) - 0.5) * 0.004
    capacity = RATED_CAPACITY * (1 - fade_frac + noise)
    soh = capacity / RATED_CAPACITY * 100
    temp = temp_base + np.sin(c / 9) * 2 + (rng.random(cycles) - 0.5) * temp_noise
    resistance = 32 + fade_frac * 140 + (rng.random(cycles) - 0.5) * 3
    voltage = 3.9 - fade_frac * 0.35 + (rng.random(cycles) - 0.5) * 0.02
    current = -180 + (rng.random(cycles) - 0.5) * 10
    hour = rng.integers(0, 24, cycles)
    dow = rng.integers(0, 7, cycles)
    soc = rng.uniform(15, 95, cycles)
    fast_charge = rng.random(cycles) < fast_charge_freq

    df = pd.DataFrame({
        "cell_id": cell_id, "cycle": c, "capacity": capacity, "soh": soh,
        "temperature": temp, "resistance": resistance, "voltage": voltage,
        "current": current, "hour": hour, "dayofweek": dow, "soc": soc,
        "fast_charge": fast_charge, "init_capacity": RATED_CAPACITY,
    })

    # occasional injected telemetry incidents -> anomaly labels
    df["is_anomaly"] = 0
    n_spikes = rng.integers(0, 2)
    for _ in range(n_spikes):
        spike_cycle = int(rng.integers(int(cycles * 0.3), cycles))
        width = 2
        idx = np.abs(df["cycle"] - spike_cycle) <= width * 2
        bump = np.exp(-((df.loc[idx, "cycle"] - spike_cycle) ** 2) / (2 * width ** 2))
        df.loc[idx, "temperature"] += 14 * bump
        df.loc[idx, "resistance"] += 9 * bump
        df.loc[idx & (bump > 0.6), "is_anomaly"] = 1

    return df


def generate_charging_sessions(rng, n=4000):
    modes = rng.choice(["AC", "DC Fast"], size=n, p=[0.62, 0.38])
    is_dc = modes == "DC Fast"
    power_kw = np.where(is_dc, rng.uniform(50, 150, n), rng.uniform(6, 11, n))
    start_soc = rng.uniform(8, 55, n)
    end_soc = np.where(is_dc, rng.uniform(58, 88, n), rng.uniform(72, 100, n))
    battery_temp = rng.uniform(10, 42, n)
    ambient_temp = battery_temp - rng.uniform(2, 8, n)
    duration = ((end_soc - start_soc) / 100) * 75 * (60 / power_kw)
    degradation_rate = rng.uniform(0.01, 0.08, n)
    efficiency = np.clip(0.95 - (power_kw > 60) * 0.05 - (battery_temp < 10) * 0.03 - (battery_temp > 40) * 0.02
                          + rng.normal(0, 0.01, n), 0.75, 0.98)
    battery_type = rng.choice(["NMC", "LFP"], size=n)
    ev_model = rng.choice(["Cargo EV 400", "Urban EV Sedan"], size=n)
    charging_cycles = rng.integers(20, 260, n)

    # ground-truth label mirrors the rule cascade used as the app's
    # transparent fallback logic, so the classifier learns the same policy
    label = np.full(n, "standard", dtype=object)
    label[(modes == "DC Fast") & (power_kw > 100) & (battery_temp > 35)] = "aggressive_fast"
    label[(label == "standard") & (end_soc >= 97)] = "full_charge_wear"
    label[(label == "standard") & (modes == "DC Fast") & (power_kw > 60)] = "fast_moderate"
    label[(label == "standard") & (battery_temp < 8)] = "cold_weather"
    label[(label == "standard") & (start_soc >= 15) & (end_soc <= 82)] = "optimal"

    return pd.DataFrame({
        "SOC": end_soc, "Voltage": rng.uniform(340, 410, n), "Current": power_kw * 1000 / 380,
        "Battery_Temp": battery_temp, "Ambient_Temp": ambient_temp, "Charging_Duration": duration,
        "Degradation_Rate": degradation_rate, "Charging_Mode": modes, "Efficiency": efficiency,
        "Battery_Type": battery_type, "Charging_Cycles": charging_cycles, "EV_Model": ev_model,
        "start_soc": start_soc, "power_kw": power_kw, "label": label,
    })


def build_datasets(n_cells=70, seed=42):
    rng = np.random.default_rng(seed)
    cells = [generate_cell(rng, i) for i in range(n_cells)]
    telemetry = pd.concat(cells, ignore_index=True)
    charging = generate_charging_sessions(rng, n=4000)
    return telemetry, charging


if __name__ == "__main__":
    telemetry, charging = build_datasets()
    telemetry.to_csv("training/synthetic_telemetry.csv", index=False)
    charging.to_csv("training/synthetic_charging.csv", index=False)
    print("telemetry:", telemetry.shape, "charging:", charging.shape)
    print(telemetry.head())
    print(charging.head())
