import { BatteryTelemetry, HealthMetrics, BatteryAnomaly, RiskLevel, EVVehiclePreset } from '../types';

export function calculateHealthMetrics(
  telemetry: BatteryTelemetry,
  vehicle: EVVehiclePreset
): HealthMetrics {
  const soh = parseFloat(((telemetry.currentCapacity / telemetry.nominalCapacity) * 100).toFixed(1));
  const eolThreshold = 80.0; // Standard 80% Capacity End of Life

  // Degradation per 100 cycles calculation
  const cyclesDone = Math.max(1, telemetry.cycleCount);
  const capacityLost = 100.0 - soh;
  const degradationRatePer100Cycles = parseFloat(((capacityLost / cyclesDone) * 100).toFixed(2));

  // Remaining useful cycles calculation until 80% SoH
  let rulCycles = 0;
  if (soh > eolThreshold) {
    const remainingPct = soh - eolThreshold;
    const ratePerCycle = degradationRatePer100Cycles / 100;
    rulCycles = Math.round(remainingPct / (ratePerCycle > 0 ? ratePerCycle : 0.012));
  } else {
    rulCycles = 0;
  }

  // Estimated RUL in years (assuming 160 cycles/year avg usage)
  const rulYears = parseFloat((rulCycles / 160).toFixed(1));

  // Estimated driving miles (assuming avg ~210 miles per cycle for standard EV pack)
  const rangePerCycle = vehicle.totalEnergyKwh * 3.2; // approx 3.2 miles per kWh
  const rulEstimatedMiles = Math.round(rulCycles * rangePerCycle);

  // Detect Anomalies
  const anomalies = detectAnomalies(telemetry, vehicle, soh);

  // Determine overall risk level
  let riskLevel: RiskLevel = 'LOW';
  const hasCritical = anomalies.some(a => a.severity === 'CRITICAL');
  const hasWarning = anomalies.some(a => a.severity === 'WARNING');

  if (hasCritical || telemetry.temperature >= 52 || soh < 75) {
    riskLevel = 'CRITICAL';
  } else if (hasWarning || telemetry.temperature >= 44 || soh < 82) {
    riskLevel = 'HIGH';
  } else if (anomalies.length > 0 || soh < 88) {
    riskLevel = 'MEDIUM';
  }

  let healthStatusText: HealthMetrics['healthStatusText'] = 'EXCELLENT';
  if (soh >= 95) healthStatusText = 'EXCELLENT';
  else if (soh >= 90) healthStatusText = 'GOOD';
  else if (soh >= 84) healthStatusText = 'MODERATE';
  else if (soh >= 80) healthStatusText = 'DEGRADED';
  else healthStatusText = 'REPLACE_SOON';

  return {
    soh,
    rulCycles,
    rulYears,
    rulEstimatedMiles,
    eolThreshold,
    degradationRatePer100Cycles,
    riskLevel,
    anomalies,
    healthStatusText
  };
}

export function detectAnomalies(
  telemetry: BatteryTelemetry,
  vehicle: EVVehiclePreset,
  soh: number
): BatteryAnomaly[] {
  const anomalies: BatteryAnomaly[] = [];
  const now = new Date().toLocaleTimeString();

  // 1. Thermal Safety Check
  if (telemetry.temperature >= 52) {
    anomalies.push({
      id: 'anom-thermal-crit',
      timestamp: now,
      type: 'THERMAL_RUNAWAY',
      severity: 'CRITICAL',
      title: 'Thermal Runaway Warning: Pack Temp > 52°C',
      description: 'Dangerous cell temperature detected. Thermal management system is under severe heat stress.',
      parameter: 'Temperature',
      value: `${telemetry.temperature}°C`,
      threshold: '< 45.0°C',
      recommendation: 'Reduce current draw immediately. Activate max active liquid cooling or park in shade.'
    });
  } else if (telemetry.temperature >= 44) {
    anomalies.push({
      id: 'anom-thermal-warn',
      timestamp: now,
      type: 'THERMAL_RUNAWAY',
      severity: 'WARNING',
      title: 'Elevated Temperature Stress (44°C+)',
      description: 'High ambient or high current charging heat accumulation accelerating chemical degradation.',
      parameter: 'Temperature',
      value: `${telemetry.temperature}°C`,
      threshold: '< 40.0°C',
      recommendation: 'Throttle charging rate from DCFC to AC 11kW until pack temperature drops below 35°C.'
    });
  }

  // 2. Lithium Plating Risk (Fast Charging at low temperatures)
  if (telemetry.temperature < 5.0 && telemetry.current > 40.0) {
    anomalies.push({
      id: 'anom-plating',
      timestamp: now,
      type: 'LITHIUM_PLATING',
      severity: 'WARNING',
      title: 'Sub-Zero Fast Charge: High Lithium Plating Risk',
      description: 'High charging current at sub-zero temperatures causes metallic lithium deposition on anode, risking short circuits.',
      parameter: 'Charge Current @ Low Temp',
      value: `${telemetry.current}A @ ${telemetry.temperature}°C`,
      threshold: '< 15A when Temp < 5°C',
      recommendation: 'Precondition battery using heat pump before plugging into DC Fast Charger.'
    });
  }

  // 3. Internal Resistance Spike
  const rBaseline = vehicle.baselineResistanceMilliOhm;
  if (telemetry.internalResistance > rBaseline * 1.35) {
    anomalies.push({
      id: 'anom-res-spike',
      timestamp: now,
      type: 'RESISTANCE_SPIKE',
      severity: 'WARNING',
      title: 'Internal Resistance Elevated (+35%)',
      description: 'Impedance growth caused by SEI layer thicking and electrolyte degradation, increasing resistive heating.',
      parameter: 'Internal Resistance',
      value: `${telemetry.internalResistance} mΩ`,
      threshold: `< ${(rBaseline * 1.25).toFixed(1)} mΩ`,
      recommendation: 'Avoid peak current accelerations to minimize heat generation in resistive cells.'
    });
  }

  // 4. Voltage Sag under Load
  if (telemetry.current < -120.0 && telemetry.voltage < vehicle.nominalVoltageV * 0.85) {
    anomalies.push({
      id: 'anom-volt-sag',
      timestamp: now,
      type: 'VOLTAGE_SAG',
      severity: 'WARNING',
      title: 'Excessive Voltage Sag Under Discharge',
      description: 'Pack voltage dropped below nominal safety threshold during peak acceleration.',
      parameter: 'Voltage',
      value: `${telemetry.voltage} V`,
      threshold: `> ${(vehicle.nominalVoltageV * 0.85).toFixed(0)} V`,
      recommendation: 'Limit aggressive power throttle usage until cell balance is restored.'
    });
  }

  // 5. Deep Discharge Loop
  if (telemetry.soc < 10) {
    anomalies.push({
      id: 'anom-deep-discharge',
      timestamp: now,
      type: 'DEEP_DISCHARGE',
      severity: 'INFO',
      title: 'Deep Discharge Zone (< 10% SoC)',
      description: 'Operating in ultra-low SoC causes copper dissolution on anode current collectors if left uncharged.',
      parameter: 'State of Charge',
      value: `${telemetry.soc}%`,
      threshold: '> 15%',
      recommendation: 'Plug in promptly to restore battery SoC above 20%.'
    });
  }

  // 6. Rapid Capacity Fade Acceleration
  if (soh < 85 && telemetry.cycleCount > 500) {
    anomalies.push({
      id: 'anom-fade-acc',
      timestamp: now,
      type: 'CAPACITY_FADE_ACCELERATION',
      severity: 'INFO',
      title: 'Capacity Fade Acceleration Zone',
      description: 'Cell aging has transitioned from linear loss phase to non-linear degradation knee.',
      parameter: 'State of Health',
      value: `${soh}%`,
      threshold: 'Linear Slope > 0.85',
      recommendation: 'Adopt strict 20-80% daily charge buffer window to delay rapid end-of-life onset.'
    });
  }

  return anomalies;
}
