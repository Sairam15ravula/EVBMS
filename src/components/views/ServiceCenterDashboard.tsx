import React, { useState } from 'react';
import {
  Wrench,
  Scan,
  Layers,
  TrendingDown,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Cpu,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { EvDiagnosticScan } from '../EvDiagnosticScan';
import { CellGridMonitor } from '../CellGridMonitor';
import { TimeSeriesTrendCharts } from '../TimeSeriesTrendCharts';
import { EVVehiclePreset, BatteryTelemetry, HealthMetrics } from '../../types';

interface ServiceCenterDashboardProps {
  vehicle: EVVehiclePreset;
  telemetry: BatteryTelemetry;
  healthMetrics: HealthMetrics;
  onOpenDoctor: (prompt?: string) => void;
}

interface ServiceAnomalyHistoryItem {
  id: string;
  timestamp: string;
  faultCode: string;
  severity: 'critical' | 'warning' | 'info';
  anomalyScore: number;
  isolationForestFlag: boolean;
  contributingSignal: string;
  leadTimeSeconds?: number;
  status: 'Open' | 'Investigating' | 'Resolved';
  actionTaken?: string;
}

const mockAnomalyHistory: ServiceAnomalyHistoryItem[] = [
  {
    id: 'anom-01',
    timestamp: '2 hours ago',
    faultCode: 'CRITICAL_HAZARD',
    severity: 'critical',
    anomalyScore: 94.2,
    isolationForestFlag: true,
    contributingSignal: 'Internal resistance jump (+140% above baseline, 38.5 mΩ)',
    leadTimeSeconds: 45,
    status: 'Investigating',
    actionTaken: 'High-voltage pack containment isolation and 4-wire Kelvin probe scheduled',
  },
  {
    id: 'anom-02',
    timestamp: '5 hours ago',
    faultCode: 'PREDICTIVE_RISK_WATCH',
    severity: 'warning',
    anomalyScore: 68.5,
    isolationForestFlag: true,
    contributingSignal: 'Cell imbalance delta reached 68 mV under 34°C discharge load',
    leadTimeSeconds: 120,
    status: 'Open',
    actionTaken: 'Passive cell balancing cycle recommended before next DC fast charge',
  },
  {
    id: 'anom-03',
    timestamp: 'Yesterday 14:22',
    faultCode: 'THERMAL_PEAK_TRANSIENT',
    severity: 'info',
    anomalyScore: 42.0,
    isolationForestFlag: false,
    contributingSignal: 'Pack temperature rose to 44.8°C during 250 kW DC Fast Charging',
    leadTimeSeconds: 300,
    status: 'Resolved',
    actionTaken: 'Active glycol cooling loop verified; thermal dissipation returned to nominal < 28°C',
  },
  {
    id: 'anom-04',
    timestamp: '3 days ago',
    faultCode: 'VOLTAGE_SAG_LOAD',
    severity: 'warning',
    anomalyScore: 71.3,
    isolationForestFlag: true,
    contributingSignal: 'Severe terminal voltage dip (-18.2V) under 180A acceleration burst',
    leadTimeSeconds: 60,
    status: 'Resolved',
    actionTaken: 'Pack busbar torque re-verified; resistance returned to nominal specification',
  },
];

export const ServiceCenterDashboard: React.FC<ServiceCenterDashboardProps> = ({
  vehicle,
  telemetry,
  healthMetrics,
  onOpenDoctor,
}) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'cells' | 'trends' | 'anomalies'>('scan');

  return (
    <div className="space-y-6">
      {/* Service Center Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                SERVICE CENTER & DIAGNOSTIC LAB
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Bay #3 • Diagnostic Scanner v2.6.4
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Diagnostic Scan, Cell Grid & Anomaly History
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              In-depth technician toolset: 3D vehicle pack scanning, 96-cell thermal & voltage heatmaps, degradation physics, and root-cause fault auditing.
            </p>
          </div>

          {/* Subview Tabs */}
          <div className="flex items-center bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs font-mono self-start md:self-auto">
            <button
              onClick={() => setActiveTab('scan')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'scan'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>3D Diagnostic Scan</span>
            </button>
            <button
              onClick={() => setActiveTab('cells')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'cells'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Cell Heatmap Grid</span>
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'trends'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              <span>Degradation Trends</span>
            </button>
            <button
              onClick={() => setActiveTab('anomalies')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                activeTab === 'anomalies'
                  ? 'bg-purple-600 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Anomaly History</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary Technician Content Screen */}
      <div>
        {activeTab === 'scan' && (
          <EvDiagnosticScan
            vehicleName={vehicle.name}
            chemistry={vehicle.chemistry === 'LFP' ? 'LFP' : 'NMC 811'}
            soh={healthMetrics.soh}
            soc={telemetry.soc}
            temperature={telemetry.temperature}
            onOpenDoctor={() =>
              onOpenDoctor(
                `Provide technician service guidelines for ${vehicle.name} based on current diagnostic scan.`
              )
            }
          />
        )}

        {activeTab === 'cells' && (
          <CellGridMonitor
            cellCount={96}
            chemistry={vehicle.chemistry}
            vehicleName={vehicle.name}
          />
        )}

        {activeTab === 'trends' && (
          <TimeSeriesTrendCharts
            currentCycle={telemetry.cycleCount}
            currentSoh={healthMetrics.soh}
            currentRul={healthMetrics.rulCycles}
            vehicleName={vehicle.name}
          />
        )}

        {activeTab === 'anomalies' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Diagnostic Anomaly History & Lead-Time Log
                </h2>
                <p className="text-xs text-slate-400">
                  Comprehensive audit trail of detected anomalies, isolation forest flags, and failure lead-time predictions
                </p>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
                NASA B0005 + Random Forest / IsoForest Models
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Fault Code</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Anomaly Score</th>
                    <th className="py-3 px-3">Contributing Signal</th>
                    <th className="py-3 px-3">Lead Time</th>
                    <th className="py-3 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {mockAnomalyHistory.map((item) => {
                    const sevColor =
                      item.severity === 'critical'
                        ? 'bg-rose-950 text-rose-400 border-rose-800'
                        : item.severity === 'warning'
                        ? 'bg-amber-950 text-amber-400 border-amber-800'
                        : 'bg-cyan-950 text-cyan-400 border-cyan-800';

                    const statusColor =
                      item.status === 'Resolved'
                        ? 'text-emerald-400'
                        : item.status === 'Investigating'
                        ? 'text-amber-400'
                        : 'text-rose-400';

                    return (
                      <tr key={item.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                          {item.timestamp}
                        </td>
                        <td className="py-3 px-3 font-bold text-white">
                          {item.faultCode}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${sevColor}`}>
                            {item.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold">
                          {item.anomalyScore.toFixed(1)} / 100
                        </td>
                        <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={item.contributingSignal}>
                          {item.contributingSignal}
                        </td>
                        <td className="py-3 px-3 text-cyan-400">
                          {item.leadTimeSeconds ? `~${item.leadTimeSeconds}s` : 'N/A'}
                        </td>
                        <td className="py-3 px-3 font-bold">
                          <span className={statusColor}>● {item.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Technician Actionable Maintenance Recommendations */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-3">
          <Wrench className="w-4 h-4 text-emerald-400" />
          Technician Maintenance & Service Protocols
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-indigo-300 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
              <span>Protocol A: Cell Balancing Recalibration</span>
            </div>
            <p className="text-slate-400 font-sans leading-relaxed text-[11px] mt-1">
              Engage slow overnight balancing charge below 3.0 kW AC. Hold battery at 100% SoC for 90 minutes to allow BMS passive shunt resistors to equalize delta voltages below 15 mV.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-amber-300 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <span>Protocol B: Thermal Management & Glycol Loop</span>
            </div>
            <p className="text-slate-400 font-sans leading-relaxed text-[11px] mt-1">
              Test coolant pump flow rate and chiller expansion valve. If operating temperature exceeds 42°C under 100 kW DC fast charging, flush cooling channels and inspect heat exchangers.
            </p>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center gap-2 text-rose-300 font-bold mb-1">
              <CheckCircle2 className="w-4 h-4 text-rose-400" />
              <span>Protocol C: High-Impedance Module Triage</span>
            </div>
            <p className="text-slate-400 font-sans leading-relaxed text-[11px] mt-1">
              Perform 4-wire AC impedance spectroscopy on high-resistance cells (&gt; 25 mΩ). If individual module capacity degradation exceeds 25%, schedule cell module warranty replacement.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
