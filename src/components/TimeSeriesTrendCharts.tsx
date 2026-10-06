import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingDown, Activity, Clock, ShieldAlert, Cpu, Sparkles } from 'lucide-react';

export interface TimeSeriesTrendDataPoint {
  cycle: number;
  measuredSoh?: number;
  predictedSoh: number;
  baselineLinearSoh: number;
  medianRul: number;
  rulLower90: number; // 5th percentile
  rulUpper90: number; // 95th percentile
  voltage: number;
  temperature: number;
  internalResistance: number;
}

interface TimeSeriesTrendChartsProps {
  currentCycle?: number;
  currentSoh?: number;
  currentRul?: number;
  vehicleName?: string;
  customData?: TimeSeriesTrendDataPoint[];
}

/**
 * Generate realistic multi-cycle degradation, quantile RUL, and thermal-voltage trajectory.
 */
export function generateSyntheticTrendData(
  startCycle = 0,
  currentCycle = 120,
  maxCycles = 400,
  initialCapacity = 100.0,
): TimeSeriesTrendDataPoint[] {
  const points: TimeSeriesTrendDataPoint[] = [];

  for (let c = startCycle; c <= maxCycles; c += 10) {
    // NASA B0005 style non-linear capacity degradation:
    // Initial linear SEI growth + accelerated degradation after knees
    const cycleFactor = c / 450.0;
    const fade = Math.pow(cycleFactor, 1.35) * 28.0;
    const predictedSoh = Math.max(65.0, Math.round((initialCapacity - fade) * 10) / 10);
    const baselineLinearSoh = Math.max(60.0, Math.round((initialCapacity - (c / 400.0) * 24.0) * 10) / 10);

    const isHistoric = c <= currentCycle;
    const measuredSoh = isHistoric
      ? Math.round((predictedSoh + (Math.sin(c / 15.0) * 0.4)) * 10) / 10
      : undefined;

    // Quantile RUL with widening uncertainty interval into future cycles
    // RUL is cycles remaining until 80% EOL
    const eolCycle = 340;
    const remainingToEol = Math.max(0, eolCycle - c);
    const uncertaintySpread = isHistoric ? 8 + c * 0.05 : 12 + (c - currentCycle) * 0.25;

    const medianRul = remainingToEol;
    const rulLower90 = Math.max(0, Math.round(medianRul - uncertaintySpread));
    const rulUpper90 = Math.round(medianRul + uncertaintySpread);

    // Terminal voltage under nominal discharge (drops slightly as resistance rises)
    const resistance = Math.round((14.0 + (c / 100.0) * 2.8) * 10) / 10;
    const voltage = Math.round((380.0 - (100.0 - predictedSoh) * 0.6) * 10) / 10;
    const temperature = Math.round((24.0 + Math.sin(c / 20.0) * 4.0 + (c / 200.0) * 3.5) * 10) / 10;

    points.push({
      cycle: c,
      measuredSoh,
      predictedSoh,
      baselineLinearSoh,
      medianRul,
      rulLower90,
      rulUpper90,
      voltage,
      temperature,
      internalResistance: resistance,
    });
  }

  return points;
}

export const TimeSeriesTrendCharts: React.FC<TimeSeriesTrendChartsProps> = ({
  currentCycle = 120,
  currentSoh = 90.5,
  currentRul = 220,
  vehicleName = 'EV Battery Pack',
  customData,
}) => {
  const [activeMetric, setActiveMetric] = useState<'soh' | 'rul' | 'telemetry'>('soh');

  const data = customData || generateSyntheticTrendData(0, currentCycle, 400, 100.0);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      {/* Header & Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            {activeMetric === 'soh' && <TrendingDown className="w-4 h-4 text-emerald-400" />}
            {activeMetric === 'rul' && <Clock className="w-4 h-4 text-indigo-400" />}
            {activeMetric === 'telemetry' && <Activity className="w-4 h-4 text-cyan-400" />}
            Time-Series Trend Analytics
          </h2>
          <p className="text-xs text-slate-400">
            {activeMetric === 'soh' && 'State of Health (SoH) degradation trajectory vs 80% EOL boundary'}
            {activeMetric === 'rul' && 'Quantile RUL forecast (Median + 90% confidence uncertainty interval)'}
            {activeMetric === 'telemetry' && 'Multi-cycle terminal voltage & thermal management trends'}
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveMetric('soh')}
            className={`px-3 py-1 rounded-lg transition ${
              activeMetric === 'soh'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SoH Trajectory
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('rul')}
            className={`px-3 py-1 rounded-lg transition ${
              activeMetric === 'rul'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            RUL (90% Interval)
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('telemetry')}
            className={`px-3 py-1 rounded-lg transition ${
              activeMetric === 'telemetry'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Voltage & Temp
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-72 w-full">
        {activeMetric === 'soh' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis
                dataKey="cycle"
                stroke="#64748b"
                fontSize={11}
                label={{ value: 'Full Equivalent Cycles', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis domain={[65, 102]} stroke="#64748b" fontSize={11} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                formatter={(val: any, name: any) => [`${val}%`, name]}
              />
              <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />

              <ReferenceLine
                y={80}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: '80% EOL Threshold', fill: '#f43f5e', fontSize: 10, position: 'top' }}
              />
              <ReferenceLine
                x={currentCycle}
                stroke="#38bdf8"
                strokeDasharray="3 3"
                label={{ value: `Current (${currentCycle})`, fill: '#38bdf8', fontSize: 10, position: 'insideTopLeft' }}
              />

              <Line
                type="monotone"
                dataKey="measuredSoh"
                name="Measured SoH (%)"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#10b981' }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="predictedSoh"
                name="ML Physics Fade Model"
                stroke="#22d3ee"
                strokeWidth={2}
                strokeDasharray="3 3"
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="baselineLinearSoh"
                name="Linear Baseline (No ML)"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeMetric === 'rul' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis
                dataKey="cycle"
                stroke="#64748b"
                fontSize={11}
                label={{ value: 'Completed Cycles', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
              />
              <YAxis stroke="#64748b" fontSize={11} unit=" cyc" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
                formatter={(val: any, name: any) => [`${val} cycles`, name]}
              />
              <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />

              <ReferenceLine
                x={currentCycle}
                stroke="#38bdf8"
                strokeDasharray="3 3"
                label={{ value: `Current (${currentCycle})`, fill: '#38bdf8', fontSize: 10, position: 'insideTopLeft' }}
              />

              {/* Shaded 90% Quantile Interval Band (5th to 95th Percentile) */}
              <Area
                type="monotone"
                dataKey="rulUpper90"
                name="95th Percentile Upper Bound"
                stroke="none"
                fill="#6366f1"
                fillOpacity={0.18}
              />
              <Area
                type="monotone"
                dataKey="rulLower90"
                name="5th Percentile Lower Bound"
                stroke="none"
                fill="#0f172a"
                fillOpacity={1.0}
              />

              {/* Median RUL Curve */}
              <Line
                type="monotone"
                dataKey="medianRul"
                name="Median Predicted RUL (Quantile 50th)"
                stroke="#818cf8"
                strokeWidth={2.5}
                dot={{ r: 2, fill: '#818cf8' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {activeMetric === 'telemetry' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
              <XAxis dataKey="cycle" stroke="#64748b" fontSize={11} />
              <YAxis
                yAxisId="volt"
                orientation="left"
                domain={[330, 400]}
                stroke="#38bdf8"
                fontSize={11}
                unit="V"
              />
              <YAxis
                yAxisId="temp"
                orientation="right"
                domain={[15, 55]}
                stroke="#f59e0b"
                fontSize={11}
                unit="°C"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  color: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'monospace',
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />

              <ReferenceLine
                yAxisId="temp"
                y={45}
                stroke="#ef4444"
                strokeDasharray="4 4"
                label={{ value: '45°C Thermal Limit', fill: '#ef4444', fontSize: 10, position: 'right' }}
              />

              <Line
                yAxisId="volt"
                type="monotone"
                dataKey="voltage"
                name="Terminal Voltage (V)"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="temp"
                type="monotone"
                dataKey="temperature"
                name="Operating Temp (°C)"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer Info Pill */}
      <div className="mt-3 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 gap-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Vehicle: <strong className="text-slate-200">{vehicleName}</strong>
        </span>
        <span>
          Current SoH: <strong className="text-emerald-400">{currentSoh}%</strong> | RUL: <strong className="text-indigo-400">{currentRul} cyc</strong>
        </span>
      </div>
    </div>
  );
};
