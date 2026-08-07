import React from 'react';
import { DegradationPoint } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ReferenceLine, ReferenceArea } from 'recharts';
import { TrendingDown, ShieldAlert, Cpu } from 'lucide-react';

interface DegradationChartProps {
  degradationData: DegradationPoint[];
  currentCycle: number;
  currentSoh: number;
}

export const DegradationChart: React.FC<DegradationChartProps> = ({
  degradationData,
  currentCycle,
  currentSoh
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-indigo-400" />
            Historical & Projected Capacity Degradation Curve
          </h2>
          <p className="text-xs text-slate-400">
            NASA B0005 & CALCE non-linear aging model vs Traditional linear estimation
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            Current Cycle: {currentCycle} ({currentSoh}% SoH)
          </div>
        </div>
      </div>

      {/* Degradation Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={degradationData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis
              dataKey="cycle"
              stroke="#64748b"
              fontSize={11}
              label={{ value: 'Total Charge/Discharge Cycles', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 }}
            />
            <YAxis
              domain={[50, 100]}
              stroke="#64748b"
              fontSize={11}
              unit="%"
            />

            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '0.75rem',
                color: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
              formatter={(val: any, name: any) => [`${val}%`, name]}
            />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontFamily: 'monospace' }} />

            {/* 80% EOL Threshold Reference Line */}
            <ReferenceLine
              y={80}
              stroke="#f43f5e"
              strokeDasharray="4 4"
              strokeWidth={2}
              label={{ value: '80% EOL Capacity Cutoff', fill: '#f43f5e', fontSize: 10, position: 'top' }}
            />

            {/* Actual Historic Measured SoH */}
            <Line
              type="monotone"
              dataKey="actualCapacityPct"
              name="Historic Measured SoH (%)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#10b981' }}
              connectNulls
            />

            {/* AI Non-Linear Predictive Curve */}
            <Line
              type="monotone"
              dataKey="aiPredictedCapacityPct"
              name="AI Predictive Model (NASA Non-Linear)"
              stroke="#22d3ee"
              strokeWidth={2}
              strokeDasharray="2 2"
              dot={false}
            />

            {/* Traditional BMS Oversimplified Linear Curve */}
            <Line
              type="monotone"
              dataKey="traditionalBmsProjectedPct"
              name="Traditional BMS (Linear Approx)"
              stroke="#64748b"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insight Footer */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2 font-mono">
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span>Notice non-linear degradation knee after ~1200 cycles due to SEI growth tail.</span>
        </div>
        <div className="text-slate-400 text-right">
          Standard Warranty Cutoff: <span className="text-emerald-400 font-bold">70% - 80% @ 1,500 Cycles</span>
        </div>
      </div>

    </div>
  );
};
