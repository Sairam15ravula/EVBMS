import React, { useState } from 'react';
import {
  Car,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  TrendingDown,
  BarChart3,
  Layers,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { EVVehiclePreset } from '../../types';

export interface FleetVehicleItem {
  id: string;
  name: string;
  model: string;
  chemistry: 'NMC' | 'LFP';
  soh: number;
  soc: number;
  temperature: number;
  internalResistance: number;
  riskScore: number; // 0 - 100
  riskLevel: 'healthy' | 'watch' | 'at-risk' | 'critical';
  activeFault?: string;
  leadTimeSeconds?: number;
  needsService: boolean;
  serviceReason?: string;
  assignedDriver?: string;
}

interface FleetOperatorDashboardProps {
  onSelectVehicle?: (vehicleId: string) => void;
  onOpenDoctor?: (prompt: string) => void;
}

const defaultFleetVehicles: FleetVehicleItem[] = [
  {
    id: 'veh-nissan-leaf',
    name: 'Nissan Leaf Gen2 #05',
    model: 'Leaf SV Plus',
    chemistry: 'NMC',
    soh: 73.8,
    soc: 35.0,
    temperature: 41.5,
    internalResistance: 38.5,
    riskScore: 92.4,
    riskLevel: 'critical',
    activeFault: 'CRITICAL_HAZARD: Resistance Spike (+140%)',
    leadTimeSeconds: 45,
    needsService: true,
    serviceReason: 'Severe capacity loss below 80% EOL boundary & high impedance',
    assignedDriver: 'Delivery Route #14',
  },
  {
    id: 'veh-f150-lightning',
    name: 'Ford F-150 Lightning #04',
    model: 'F-150 Lightning ER',
    chemistry: 'NMC',
    soh: 84.1,
    soc: 42.0,
    temperature: 34.0,
    internalResistance: 21.0,
    riskScore: 68.2,
    riskLevel: 'at-risk',
    activeFault: 'PREDICTIVE_RISK_WATCH: Cell Delta 68 mV',
    leadTimeSeconds: 120,
    needsService: true,
    serviceReason: 'Thermal cycling cell imbalance approaching safety envelope',
    assignedDriver: 'Heavy Haul Route #02',
  },
  {
    id: 'veh-ioniq-5',
    name: 'Hyundai Ioniq 5 #02',
    model: 'Ioniq 5 AWD',
    chemistry: 'NMC',
    soh: 88.0,
    soc: 64.0,
    temperature: 28.0,
    internalResistance: 17.5,
    riskScore: 32.5,
    riskLevel: 'watch',
    activeFault: 'Fast-Charge Thermal Ramp Transient',
    leadTimeSeconds: 300,
    needsService: false,
    assignedDriver: 'Metro Express #08',
  },
  {
    id: 'veh-tesla-m3',
    name: 'Tesla Model 3 LR #01',
    model: 'Model 3 LR',
    chemistry: 'NMC',
    soh: 91.5,
    soc: 78.0,
    temperature: 24.5,
    internalResistance: 14.2,
    riskScore: 12.0,
    riskLevel: 'healthy',
    needsService: false,
    assignedDriver: 'Executive Fleet #01',
  },
  {
    id: 'veh-byd-atto3',
    name: 'BYD Atto 3 Blade #03',
    model: 'Atto 3 Standard',
    chemistry: 'LFP',
    soh: 96.2,
    soc: 85.0,
    temperature: 22.0,
    internalResistance: 13.0,
    riskScore: 5.4,
    riskLevel: 'healthy',
    needsService: false,
    assignedDriver: 'Regional Courier #11',
  },
];

export const FleetOperatorDashboard: React.FC<FleetOperatorDashboardProps> = ({
  onSelectVehicle,
  onOpenDoctor,
}) => {
  const [vehicles, setVehicles] = useState<FleetVehicleItem[]>(defaultFleetVehicles);
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [dispatchedVehicles, setDispatchedVehicles] = useState<Set<string>>(new Set());

  // Fleet Aggregates
  const totalVehicles = vehicles.length;
  const avgSoh = Math.round((vehicles.reduce((acc, v) => acc + v.soh, 0) / totalVehicles) * 10) / 10;
  const criticalCount = vehicles.filter((v) => v.riskLevel === 'critical' || v.riskLevel === 'at-risk').length;
  const serviceNeededCount = vehicles.filter((v) => v.needsService && !dispatchedVehicles.has(v.id)).length;

  // SoH Distribution Histogram
  const sohDistribution = [
    { tier: '< 80% (Critical)', count: vehicles.filter((v) => v.soh < 80).length, color: '#f43f5e' },
    { tier: '80-85% (Watch)', count: vehicles.filter((v) => v.soh >= 80 && v.soh < 85).length, color: '#f59e0b' },
    { tier: '85-90% (Good)', count: vehicles.filter((v) => v.soh >= 85 && v.soh < 90).length, color: '#38bdf8' },
    { tier: '90-100% (Prime)', count: vehicles.filter((v) => v.soh >= 90).length, color: '#10b981' },
  ];

  // Vehicles sorted by risk (highest risk first)
  const rankedVehicles = [...vehicles].sort((a, b) => b.riskScore - a.riskScore);
  const filteredVehicles =
    filterLevel === 'all'
      ? rankedVehicles
      : rankedVehicles.filter((v) => v.riskLevel === filterLevel);

  const handleDispatchService = (vehicleId: string) => {
    setDispatchedVehicles((prev) => new Set(prev).add(vehicleId));
  };

  return (
    <div className="space-y-6">
      {/* Fleet Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                FLEET OPERATOR CONTROL CENTER
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Active Telematics: 5 Commercial Assets
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Fleet Degradation, Risk Ranking & Service Triage
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Real-time multi-vehicle health monitoring, predictive risk indexing, and proactive service routing before battery failures happen.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                onOpenDoctor &&
                onOpenDoctor('Summarize the top operational battery risks across the commercial fleet.')
              }
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-mono font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <span>AI Fleet Diagnostic Report</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fleet KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Commercial Fleet Size</span>
            <Car className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white">{totalVehicles} Vehicles</span>
            <span className="text-xs text-emerald-400 font-bold">100% Online</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">NMC (4) • LFP Blade (1)</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Fleet Average SoH</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-400">{avgSoh}%</span>
            <span className="text-xs text-slate-400">Target &gt; 85%</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Weighted across 383.9 kWh pack capacity</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>High Risk Assets</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-amber-400">{criticalCount}</span>
            <span className="text-xs text-rose-400 font-bold">1 EOL Bound</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Require operational duty cycle limit</p>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4.5">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Service Triage Queue</span>
            <Wrench className="w-4 h-4 text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-rose-400">{serviceNeededCount}</span>
            <span className="text-xs text-indigo-300">Action Needed</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">Pending technician dispatch</p>
        </div>
      </div>

      {/* Fleet SoH Distribution Chart & Service Triage Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet SoH Distribution Histogram */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              Fleet SoH Health Distribution
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              Asset segmentation by capacity fade boundary
            </p>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sohDistribution} margin={{ top: 10, right: 10, left: -25, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
                <XAxis
                  dataKey="tier"
                  stroke="#64748b"
                  fontSize={10}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#f8fafc',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                  formatter={(val: any) => [`${val} Vehicles`, 'Count']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {sohDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-2 text-[11px] font-mono text-slate-400 text-center">
            Critical tier indicates pack capacity below 80% warranty threshold
          </div>
        </div>

        {/* Vehicles Needing Service Triage Queue */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                <Wrench className="w-4 h-4 text-rose-400" />
                Vehicles Needing Service (Triage Queue)
              </h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800">
                {serviceNeededCount} Flagged
              </span>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              Autonomous failure prediction triggers based on thermal rise, cell impedance jump, and voltage sag
            </p>
          </div>

          <div className="space-y-3">
            {vehicles
              .filter((v) => v.needsService)
              .map((v) => {
                const isDispatched = dispatchedVehicles.has(v.id);
                return (
                  <div
                    key={v.id}
                    className="bg-slate-950/80 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 font-mono">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{v.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 font-bold uppercase">
                            Risk {v.riskScore.toFixed(1)}/100
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {v.model} • Driver: {v.assignedDriver}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isDispatched ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Dispatched
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDispatchService(v.id)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <Wrench className="w-3.5 h-3.5" />
                            <span>Dispatch Service</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80 text-xs">
                      <p className="text-slate-300 font-medium">
                        <strong className="text-rose-400 font-mono">Diagnosis: </strong>
                        {v.serviceReason}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] font-mono text-slate-400">
                        <span>SoH: <strong className="text-white">{v.soh}%</strong></span>
                        <span>Pack Temp: <strong className="text-amber-400">{v.temperature}°C</strong></span>
                        <span>Resistance: <strong className="text-white">{v.internalResistance} mΩ</strong></span>
                        {v.leadTimeSeconds && (
                          <span className="text-cyan-400">
                            Est. Failure Lead Time: ~{v.leadTimeSeconds}s
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* All Vehicles Ranked by Risk Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              All Vehicles Ranked by Predictive Risk
            </h2>
            <p className="text-xs text-slate-400">
              Sorted by composite failure risk score incorporating ML anomaly probability and battery impedance rate
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            {['all', 'critical', 'at-risk', 'watch', 'healthy'].map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilterLevel(lvl)}
                className={`px-2.5 py-1 rounded-lg capitalize transition ${
                  filterLevel === lvl
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Vehicle Asset</th>
                <th className="py-3 px-3">Chemistry</th>
                <th className="py-3 px-3">State of Health</th>
                <th className="py-3 px-3">Pack Temp</th>
                <th className="py-3 px-3">Impedance</th>
                <th className="py-3 px-3">Risk Level</th>
                <th className="py-3 px-3 text-right">Risk Score</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-200">
              {filteredVehicles.map((v) => {
                const badgeColor =
                  v.riskLevel === 'critical'
                    ? 'bg-rose-950 text-rose-400 border-rose-800'
                    : v.riskLevel === 'at-risk'
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : v.riskLevel === 'watch'
                    ? 'bg-yellow-950 text-yellow-400 border-yellow-800'
                    : 'bg-emerald-950 text-emerald-400 border-emerald-800';

                return (
                  <tr key={v.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{v.name}</div>
                      <div className="text-[10px] text-slate-500">{v.model}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {v.chemistry}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-bold">
                      <span className={v.soh < 80 ? 'text-rose-400' : 'text-emerald-400'}>
                        {v.soh}%
                      </span>
                    </td>
                    <td className="py-3 px-3">{v.temperature}°C</td>
                    <td className="py-3 px-3">{v.internalResistance} mΩ</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase ${badgeColor}`}>
                        {v.riskLevel}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold">
                      <span className={v.riskScore > 60 ? 'text-rose-400' : v.riskScore > 30 ? 'text-amber-400' : 'text-emerald-400'}>
                        {v.riskScore.toFixed(1)} / 100
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {onSelectVehicle && (
                        <button
                          onClick={() => onSelectVehicle(v.id)}
                          className="text-cyan-400 hover:text-cyan-300 font-bold underline"
                        >
                          Inspect →
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
