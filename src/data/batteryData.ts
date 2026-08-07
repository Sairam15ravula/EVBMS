import { EVVehiclePreset, ScenarioPreset, DegradationPoint, BatteryTelemetry } from '../types';

export const VEHICLE_PRESETS: EVVehiclePreset[] = [
  {
    id: 'tesla-m3',
    name: 'Tesla Model 3 Long Range',
    model: '75 kWh Pack (NMC 811)',
    packType: '96S4P Cylindrical 2170',
    chemistry: 'NMC',
    nominalCapacityAh: 230,
    nominalVoltageV: 350,
    totalEnergyKwh: 75,
    baselineResistanceMilliOhm: 14.2,
    maxChargingKw: 250,
    description: 'High energy density nickel-manganese-cobalt cells optimized for fast acceleration and V3 Supercharging.'
  },
  {
    id: 'ioniq-5',
    name: 'Hyundai Ioniq 5 AWD',
    model: '77.4 kWh Pack (E-GMP)',
    packType: '192 Pouch Cell Module',
    chemistry: 'NMC',
    nominalCapacityAh: 215,
    nominalVoltageV: 697,
    totalEnergyKwh: 77.4,
    baselineResistanceMilliOhm: 11.8,
    maxChargingKw: 220,
    description: '800V ultra-fast architecture with active liquid cooling and bidirectional V2L support.'
  },
  {
    id: 'rivian-r1t',
    name: 'Rivian R1T Large Pack',
    model: '135 kWh Pack (Heavy Duty)',
    packType: 'Dual Layer Modular',
    chemistry: 'NMC',
    nominalCapacityAh: 360,
    nominalVoltageV: 375,
    totalEnergyKwh: 135,
    baselineResistanceMilliOhm: 18.5,
    maxChargingKw: 220,
    description: 'Heavy duty off-road pack subjected to high thermal loads and towing power draws.'
  },
  {
    id: 'lfp-city-ev',
    name: 'Compact City EV (LFP)',
    model: '60 kWh Blade Pack',
    packType: 'Cell-to-Pack (CTP) LFP',
    chemistry: 'LFP',
    nominalCapacityAh: 200,
    nominalVoltageV: 320,
    totalEnergyKwh: 60,
    baselineResistanceMilliOhm: 16.0,
    maxChargingKw: 150,
    description: 'Lithium Iron Phosphate pack with high thermal stability and 3000+ cycle life capability.'
  }
];

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'healthy-new',
    title: 'Brand New Pack (0 - 10,000 miles)',
    vehicleId: 'tesla-m3',
    description: 'Optimal factory condition. Minimal SEI layer buildup, low internal resistance, high capacity stability.',
    initialCycle: 45,
    soh: 98.8,
    tempProfile: 'NORMAL',
    chargingHabit: 'BALANCED_AC',
    simulatedAnomaliesCount: 0
  },
  {
    id: 'mid-life-dcfc',
    title: '50,000 Miles (Frequent DC Fast Charging)',
    vehicleId: 'tesla-m3',
    description: 'Mid-life battery with accelerated capacity loss due to frequent 150kW+ DCFC sessions and high peak temps.',
    initialCycle: 520,
    soh: 88.4,
    tempProfile: 'HOT_DESERT',
    chargingHabit: 'FREQUENT_DCFC',
    simulatedAnomaliesCount: 2
  },
  {
    id: 'subzero-winter',
    title: 'Winter Extreme Cold & Lithium Plating Risk',
    vehicleId: 'ioniq-5',
    description: 'Cold weather driving (-8°C) causing high internal resistance, voltage sag during acceleration, and plating risk.',
    initialCycle: 310,
    soh: 91.5,
    tempProfile: 'SUB_ZERO',
    chargingHabit: 'FREQUENT_DCFC',
    simulatedAnomaliesCount: 3
  },
  {
    id: 'high-cycle-degraded',
    title: 'High-Mileage Aged Pack (EOL Boundary)',
    vehicleId: 'rivian-r1t',
    description: 'High-cycle pack approaching 80% State of Health EOL threshold. Internal resistance up +65%, severe thermal generation.',
    initialCycle: 1240,
    soh: 81.2,
    tempProfile: 'HOT_DESERT',
    chargingHabit: 'DEEP_DISCHARGE_LOOPS',
    simulatedAnomaliesCount: 4
  },
  {
    id: 'thermal-runaway-stress',
    title: 'Critical Fault: Thermal Runaway Stress Test',
    vehicleId: 'tesla-m3',
    description: 'Simulated cooling pump degradation causing local cell overheating (> 52°C) under high current discharge.',
    initialCycle: 680,
    soh: 84.0,
    tempProfile: 'THERMAL_SPIKE',
    chargingHabit: 'FREQUENT_DCFC',
    simulatedAnomaliesCount: 5
  }
];

/**
 * Generates NASA Battery B0005/CALCE based degradation curve (Cycles 0 to 2000)
 */
export function generateDegradationCurve(
  initialSoH: number,
  currentCycle: number,
  chemistry: 'NMC' | 'LFP' = 'NMC'
): DegradationPoint[] {
  const points: DegradationPoint[] = [];
  const maxCycle = 2000;
  const step = 50;

  // NASA B0005 Empirical parameters:
  // Capacity Ah(n) = C0 * (1 - alpha * n^0.6 - beta * exp(gamma * n))
  const alpha = chemistry === 'LFP' ? 0.00015 : 0.00028;
  const beta = chemistry === 'LFP' ? 0.000005 : 0.000018;
  const gamma = 0.0028;

  for (let cycle = 0; cycle <= maxCycle; cycle += step) {
    // Standard degradation physics model
    const degradationFraction = alpha * Math.pow(cycle, 0.6) + beta * Math.exp(gamma * (cycle / 100));
    const aiPredictedSoH = Math.max(60, Math.min(100, 100 - degradationFraction * 100));

    // Linear projection (Traditional BMS oversimplification)
    const traditionalLinearSoH = Math.max(50, 100 - (cycle * 0.0125));

    const isFuture = cycle > currentCycle;

    let actualCapPct: number | undefined = undefined;
    if (!isFuture) {
      // Add small realistic noise to historic points mirroring CALCE laboratory impedance measurements
      const noise = (Math.sin(cycle * 0.1) * 0.3) + (Math.cos(cycle * 0.05) * 0.2);
      actualCapPct = Math.max(65, Math.min(100, aiPredictedSoH + noise));
    }

    let notes: string | undefined = undefined;
    if (cycle === 0) notes = 'New Pack Baseline';
    if (cycle === 500) notes = 'First Major Service Check';
    if (cycle === 1000) notes = '50% Expected Lifecycle';
    if (aiPredictedSoH <= 80 && aiPredictedSoH >= 78.5) notes = '80% EOL Capacity Cutoff';

    points.push({
      cycle,
      actualCapacityPct: actualCapPct !== undefined ? parseFloat(actualCapPct.toFixed(1)) : undefined,
      traditionalBmsProjectedPct: parseFloat(traditionalLinearSoH.toFixed(1)),
      aiPredictedCapacityPct: parseFloat(aiPredictedSoH.toFixed(1)),
      isFuture,
      notes
    });
  }

  return points;
}

/**
 * Creates dynamic real-time telemetry frame based on active driving state
 */
export function generateLiveTelemetryFrame(
  preset: EVVehiclePreset,
  scenario: ScenarioPreset,
  timeOffsetSec: number
): BatteryTelemetry {
  const baseTemp = scenario.tempProfile === 'SUB_ZERO' ? -6 :
                   scenario.tempProfile === 'HOT_DESERT' ? 38 :
                   scenario.tempProfile === 'THERMAL_SPIKE' ? 48 : 25;

  // Cycle phase (e.g. driving discharge vs regenerative braking vs DCFC)
  const phase = Math.floor(timeOffsetSec / 15) % 4; 
  let currentA = 0;
  let socDelta = 0;

  if (phase === 0) {
    // Highway Cruising
    currentA = -65.0 - Math.sin(timeOffsetSec * 0.5) * 15;
    socDelta = -0.05;
  } else if (phase === 1) {
    // Hard Acceleration
    currentA = -180.0 - Math.cos(timeOffsetSec * 0.8) * 45;
    socDelta = -0.12;
  } else if (phase === 2) {
    // Regenerative Braking
    currentA = 85.0 + Math.sin(timeOffsetSec * 0.4) * 25;
    socDelta = +0.06;
  } else {
    // Rapid DC Fast Charging
    currentA = 165.0 + Math.sin(timeOffsetSec * 0.2) * 10;
    socDelta = +0.18;
  }

  // Calculate SoC %
  let soc = Math.max(5, Math.min(98, 72.0 + Math.sin(timeOffsetSec * 0.05) * 8.0 + (timeOffsetSec % 60) * socDelta * 0.1));
  soc = parseFloat(soc.toFixed(1));

  // Voltage dynamics: V = V_oc(SoC) - I * R_int
  const openCircuitVoltage = preset.nominalVoltageV * (0.88 + 0.15 * (soc / 100));
  const rInternal = preset.baselineResistanceMilliOhm * (1 + (100 - scenario.soh) * 0.02) * (scenario.tempProfile === 'SUB_ZERO' ? 1.8 : 1.0);
  const voltageDrop = (currentA * (rInternal / 1000));
  let voltage = openCircuitVoltage + voltageDrop;
  voltage = parseFloat(voltage.toFixed(1));

  // Temperature dynamics with Joule heating (I^2 * R)
  const jouleHeatFactor = (Math.pow(currentA / 100, 2) * (rInternal / 10)) * 0.05;
  let temp = baseTemp + (timeOffsetSec * 0.08) + jouleHeatFactor;
  if (scenario.tempProfile === 'THERMAL_SPIKE') {
    temp += Math.min(18, timeOffsetSec * 0.35);
  }
  temp = parseFloat(temp.toFixed(1));

  // Current Capacity
  const currentCapAh = preset.nominalCapacityAh * (scenario.soh / 100);

  const powerKw = parseFloat(((voltage * Math.abs(currentA)) / 1000).toFixed(1));

  return {
    timestamp: new Date().toLocaleTimeString(),
    voltage,
    current: parseFloat(currentA.toFixed(1)),
    temperature: temp,
    soc,
    internalResistance: parseFloat(rInternal.toFixed(2)),
    cycleCount: scenario.initialCycle,
    nominalCapacity: preset.nominalCapacityAh,
    currentCapacity: parseFloat(currentCapAh.toFixed(1)),
    cellImbalance: parseFloat((2.5 + (100 - scenario.soh) * 0.25 + Math.random() * 2).toFixed(1)),
    powerKw
  };
}
