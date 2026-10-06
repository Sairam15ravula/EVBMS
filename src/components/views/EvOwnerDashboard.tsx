import React from 'react';
import {
  Battery,
  BatteryCharging,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Bot,
  Gauge,
  Thermometer,
  Activity,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { BatteryTelemetry, HealthMetrics, EVVehiclePreset, BatteryAnomaly } from '../../types';
import { SmartRecommendations } from '../SmartRecommendations';
import { AlertFeed } from '../AlertFeed';
import { TimeSeriesTrendCharts } from '../TimeSeriesTrendCharts';

interface EvOwnerDashboardProps {
  vehicle: EVVehiclePreset;
  telemetry: BatteryTelemetry;
  healthMetrics: HealthMetrics;
  onOpenDoctor: (prompt?: string) => void;
}

export const EvOwnerDashboard: React.FC<EvOwnerDashboardProps> = ({
  vehicle,
  telemetry,
  healthMetrics,
  onOpenDoctor,
}) => {
  const isHealthy = healthMetrics.soh >= 85;
  const isWatch = healthMetrics.soh >= 80 && healthMetrics.soh < 85;
  const rangeKm = Math.round((telemetry.soc / 100.0) * (vehicle.totalEnergyKwh * 5.8));

  return (
    <div className="space-y-6">
      {/* EV Owner Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                EV OWNER DASHBOARD
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Assigned: {vehicle.name} ({vehicle.chemistry})
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              My Battery Health & Operational Advisory
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Continuous real-time battery pack diagnostics, intelligent charging guidance, and early-warning safety alerts tailored for your EV.
            </p>
          </div>

          <button
            onClick={() => onOpenDoctor('Give me a full diagnostic checkup of my EV battery pack.')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-mono font-bold shadow-lg shadow-indigo-600/30 transition self-start md:self-auto shrink-0"
          >
            <Bot className="w-4 h-4" />
            <span>Consult Digital Doctor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Key Battery Vital Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* State of Charge (SoC) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>State of Charge (SoC)</span>
            <Battery className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {telemetry.soc.toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-cyan-400 font-bold">
              ~{rangeKm} km Range
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mt-3 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
              style={{ width: `${Math.min(100, telemetry.soc)}%` }}
            />
          </div>
        </div>

        {/* State of Health (SoH) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>State of Health (SoH)</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {healthMetrics.soh.toFixed(1)}%
            </span>
            <span
              className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                isHealthy
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : isWatch
                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                  : 'bg-rose-950 text-rose-400 border border-rose-800'
              }`}
            >
              {healthMetrics.healthStatusText || (isHealthy ? 'HEALTHY' : isWatch ? 'WATCH' : 'CRITICAL')}
            </span>
          </div>
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mt-3 border border-slate-800">
            <div
              className={`h-full rounded-full ${
                isHealthy ? 'bg-emerald-500' : isWatch ? 'bg-amber-500' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, healthMetrics.soh)}%` }}
            />
          </div>
        </div>

        {/* Remaining Useful Life (RUL) */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>Remaining Useful Life</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {healthMetrics.rulCycles ?? healthMetrics.estimatedRemainingCycles ?? 0}
            </span>
            <span className="text-xs font-mono text-indigo-300">
              ~{(healthMetrics.rulYears ?? healthMetrics.estimatedRemainingYears ?? 0).toFixed(1)} Years
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-2">
            Before reaching the 80% EOL boundary (NASA non-linear model).
          </p>
        </div>

        {/* Operating Temperature */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs font-mono mb-2">
            <span>Pack Temperature</span>
            <Thermometer className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-white">
              {telemetry.temperature.toFixed(1)}°C
            </span>
            <span
              className={`text-xs font-mono font-bold ${
                telemetry.temperature > 42
                  ? 'text-rose-400'
                  : telemetry.temperature < 5
                  ? 'text-blue-400'
                  : 'text-emerald-400'
              }`}
            >
              {telemetry.temperature > 42 ? 'HOT' : telemetry.temperature < 5 ? 'COLD' : 'NOMINAL'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono mt-2">
            Internal resistance: {(telemetry.internalResistance ?? telemetry.internal_resistance_mohm ?? 15.0).toFixed(1)} mΩ
          </p>
        </div>
      </div>

      {/* Main Owner Split: Charging Recommendations & Active Vehicle Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <SmartRecommendations
            telemetry={telemetry}
            healthMetrics={healthMetrics}
            vehicle={vehicle}
            onOpenDoctor={() => onOpenDoctor('Explain how the recommended charging strategy preserves my pack life.')}
          />
        </div>

        <div className="lg:col-span-2">
          <AlertFeed
            anomalies={healthMetrics.anomalies || []}
            onAskDoctorAboutAnomaly={(anom: BatteryAnomaly) =>
              onOpenDoctor(
                `Explain anomaly "${anom.title}" with value ${anom.value} (threshold: ${anom.threshold}). What should I do right now?`
              )
            }
          />
        </div>
      </div>

      {/* Time-Series Degradation & RUL Forecast Chart */}
      <TimeSeriesTrendCharts
        currentCycle={telemetry.cycleCount}
        currentSoh={healthMetrics.soh}
        currentRul={healthMetrics.rulCycles}
        vehicleName={vehicle.name}
      />
    </div>
  );
};
