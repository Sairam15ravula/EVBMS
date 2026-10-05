import React from 'react';
import { BatteryTelemetry, HealthMetrics, EVVehiclePreset } from '../types';
import { BatteryCharging, Heart, Calendar, Thermometer, ShieldAlert, Zap, TrendingDown } from 'lucide-react';

interface MetricCardsProps {
  telemetry: BatteryTelemetry;
  healthMetrics: HealthMetrics;
  vehicle: EVVehiclePreset;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  telemetry,
  healthMetrics,
  vehicle
}) => {
  // Risk level badge styling
  const riskBadgeStyles = {
    LOW: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 shadow-emerald-950/50',
    MEDIUM: 'bg-amber-950/80 text-amber-400 border-amber-800/80 shadow-amber-950/50',
    HIGH: 'bg-orange-950/80 text-orange-400 border-orange-800/80 shadow-orange-950/50',
    CRITICAL: 'bg-rose-950/80 text-rose-400 border-rose-800/80 shadow-rose-950/50 animate-pulse'
  }[healthMetrics.riskLevel];

  // Temp badge styling
  const isHighTemp = telemetry.temperature >= 44;
  const isColdTemp = telemetry.temperature < 5;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      
      {/* 1. State of Charge (SoC) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" /> SoC Level
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {telemetry.voltage} V
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-3xl font-bold font-mono text-white">
              {telemetry.soc}<span className="text-lg text-slate-400 font-normal">%</span>
            </span>
            <span className="text-xs font-mono text-cyan-400">
              {telemetry.current >= 0 ? `+${telemetry.current}A` : `${telemetry.current}A`}
            </span>
          </div>

          {/* SoC Progress Bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                telemetry.soc > 20
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                  : 'bg-gradient-to-r from-rose-500 to-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, telemetry.soc))}%` }}
            />
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Power: {telemetry.powerKw || 0} kW</span>
          <span>Res: {telemetry.internalResistance} mΩ</span>
        </div>
      </div>

      {/* 2. State of Health (SoH) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Heart className="w-3.5 h-3.5 text-emerald-400" /> Health (SoH)
          </span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
            healthMetrics.soh >= 90 ? 'bg-emerald-950 text-emerald-400 border-emerald-800' :
            healthMetrics.soh >= 80 ? 'bg-amber-950 text-amber-400 border-amber-800' :
            'bg-rose-950 text-rose-400 border-rose-800'
          }`}>
            {healthMetrics.healthStatusText}
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-3xl font-bold font-mono text-white">
              {healthMetrics.soh}<span className="text-lg text-slate-400 font-normal">%</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              {telemetry.currentCapacity} / {telemetry.nominalCapacity} Ah
            </span>
          </div>

          {/* SoH Bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                healthMetrics.soh >= 85 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                healthMetrics.soh >= 80 ? 'bg-gradient-to-r from-amber-500 to-yellow-400' :
                'bg-gradient-to-r from-rose-600 to-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, healthMetrics.soh))}%` }}
            />
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Cycle: {telemetry.cycleCount}</span>
          <span className="text-slate-400 flex items-center gap-1">
            <TrendingDown className="w-3 h-3 text-amber-400" />
            -{healthMetrics.degradationRatePer100Cycles}% /100cyc
          </span>
        </div>
      </div>

      {/* 3. Remaining Useful Life (RUL) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" /> Est. RUL
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/50">
            EOL @ 80%
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-3xl font-bold font-mono text-white">
              {healthMetrics.rulYears}<span className="text-lg text-slate-400 font-normal"> yrs</span>
            </span>
            <span className="text-xs font-mono text-indigo-300">
              ~{healthMetrics.rulCycles} Cycles
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Est. ~{healthMetrics.rulEstimatedMiles.toLocaleString()} mi</span>
            {healthMetrics.confidenceInterval90 ? (
              <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                90% CI: [{healthMetrics.confidenceInterval90[0]}–{healthMetrics.confidenceInterval90[1]} cyc]
              </span>
            ) : healthMetrics.rulLower != null && healthMetrics.rulUpper != null ? (
              <span className="text-[10px] text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded border border-indigo-800/40">
                90% CI: [{Math.round(healthMetrics.rulLower)}–{Math.round(healthMetrics.rulUpper)} cyc]
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Chemistry: {vehicle.chemistry}</span>
          <span className="text-indigo-400">Predictive XAI</span>
        </div>
      </div>

      {/* 4. Pack Temperature */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Thermometer className={`w-3.5 h-3.5 ${isHighTemp ? 'text-rose-400' : isColdTemp ? 'text-cyan-400' : 'text-amber-400'}`} />
            Temperature
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            isHighTemp ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' :
            isColdTemp ? 'bg-cyan-950 text-cyan-300 border-cyan-800' :
            'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            {isHighTemp ? 'HOT' : isColdTemp ? 'COLD' : 'OPTIMAL'}
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className={`text-3xl font-bold font-mono ${isHighTemp ? 'text-rose-400' : 'text-white'}`}>
              {telemetry.temperature}<span className="text-lg text-slate-400 font-normal">°C</span>
            </span>
            <span className="text-xs font-mono text-slate-400">
              Limit: 45°C
            </span>
          </div>

          {/* Temp Gauge Bar */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden p-0.5 border border-slate-800/80">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                telemetry.temperature > 45 ? 'bg-gradient-to-r from-amber-500 to-rose-600' :
                telemetry.temperature < 5 ? 'bg-gradient-to-r from-cyan-600 to-blue-500' :
                'bg-gradient-to-r from-emerald-500 to-teal-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(10, ((telemetry.temperature + 15) / 75) * 100))}%` }}
            />
          </div>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>Active Cooling: ON</span>
          <span>Imbalance: {telemetry.cellImbalance || 3} mV</span>
        </div>
      </div>

      {/* 5. Failure Risk Level */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-slate-700 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-400" /> Failure Risk
          </span>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shadow-sm font-bold ${riskBadgeStyles}`}>
            {healthMetrics.riskLevel}
          </span>
        </div>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-3xl font-bold font-mono text-white">
              {healthMetrics.anomalies.length}
            </span>
            <span className="text-xs font-mono text-slate-400">
              Active Flags
            </span>
          </div>
          <p className="text-xs text-slate-400 line-clamp-1 font-mono">
            {healthMetrics.anomalies.length > 0
              ? healthMetrics.anomalies[0].title
              : 'All parameters operating within safe envelope'}
          </p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
          <span className="text-slate-400">Anomaly Shield</span>
          <span className={healthMetrics.anomalies.length > 0 ? 'text-amber-400' : 'text-emerald-400'}>
            {healthMetrics.anomalies.length > 0 ? 'Action Recommended' : 'Shield Active'}
          </span>
        </div>
      </div>

    </div>
  );
};
