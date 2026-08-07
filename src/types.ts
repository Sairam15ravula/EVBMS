/**
 * EV Battery Intelligence Platform Types
 */

export interface BatteryTelemetry {
  timestamp: string;
  voltage: number;         // V (e.g., 340.0 - 415.0)
  current: number;         // A (-250A to +150A)
  temperature: number;     // °C
  soc: number;             // % (0 - 100)
  internalResistance: number; // mΩ (e.g., 12.5 - 35.0)
  cycleCount: number;      // Completed charge/discharge cycles
  nominalCapacity: number; // Nominal Ah (e.g., 200 Ah)
  currentCapacity: number; // Current Ah (e.g., 182.4 Ah)
  cellImbalance?: number;  // mV difference between cells
  powerKw?: number;        // kW
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface BatteryAnomaly {
  id: string;
  timestamp: string;
  type: 'THERMAL_RUNAWAY' | 'VOLTAGE_SAG' | 'RESISTANCE_SPIKE' | 'DEEP_DISCHARGE' | 'LITHIUM_PLATING' | 'CAPACITY_FADE_ACCELERATION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  parameter: string;
  value: string;
  threshold: string;
  recommendation: string;
}

export interface HealthMetrics {
  soh: number;             // State of Health % (e.g., 91.2%)
  rulCycles: number;       // Remaining Useful Life in cycles
  rulYears: number;        // Remaining Useful Life in estimated years
  rulEstimatedMiles: number; // Estimated remaining driving miles
  eolThreshold: number;    // EOL capacity % (usually 80%)
  degradationRatePer100Cycles: number; // % capacity loss per 100 cycles
  riskLevel: RiskLevel;
  anomalies: BatteryAnomaly[];
  healthStatusText: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'DEGRADED' | 'REPLACE_SOON';
}

export interface DegradationPoint {
  cycle: number;
  actualCapacityPct?: number; // Ah / Nominal Ah %
  traditionalBmsProjectedPct?: number;
  aiPredictedCapacityPct: number;
  isFuture: boolean;
  notes?: string;
}

export interface EVVehiclePreset {
  id: string;
  name: string;
  model: string;
  packType: string;
  chemistry: 'NMC' | 'LFP' | 'NCA';
  nominalCapacityAh: number;
  nominalVoltageV: number;
  totalEnergyKwh: number;
  baselineResistanceMilliOhm: number;
  maxChargingKw: number;
  description: string;
}

export interface ScenarioPreset {
  id: string;
  title: string;
  vehicleId: string;
  description: string;
  initialCycle: number;
  soh: number;
  tempProfile: 'NORMAL' | 'HOT_DESERT' | 'SUB_ZERO' | 'THERMAL_SPIKE';
  chargingHabit: 'BALANCED_AC' | 'FREQUENT_DCFC' | 'DEEP_DISCHARGE_LOOPS';
  simulatedAnomaliesCount: number;
}

export interface AIExplainResponse {
  summary: string;
  degradationCauses: {
    factor: string;
    impactPercentage: number;
    description: string;
  }[];
  healthDiagnosis: string;
  riskAssessment: {
    level: RiskLevel;
    thermalRunawayRisk: string;
    lithiumPlatingRisk: string;
    cellDegradationRisk: string;
  };
  actionPlan: string[];
  estimatedRemainingYears: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}
