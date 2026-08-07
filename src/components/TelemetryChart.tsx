import React, { useState } from 'react';
import { BatteryTelemetry } from '../types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Activity, Gauge, Flame, Zap } from 'lucide-react';

interface TelemetryChartProps {
  history: BatteryTelemetry[];
  currentTelemetry: BatteryTelemetry;
}

export const TelemetryChart: React.FC<TelemetryChartProps> = ({
  history,
  currentTelemetry
}) => {
  const [activeTab, setActiveTab] = useState<'VI' | 'TR' | 'SOC'>('VI');

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
      
      {/* Chart Controls & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Real-Time Telemetry Stream
          </h2>
          <p className="text-xs text-slate-400">
            Simulated high-frequency cell telemetry (NASA / CALCE data rate)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800/80 self-start sm:self-auto text-xs">
          <button
            onClick={() => setActiveTab('VI')}
            className={`px-3 py-1 rounded-lg font-mono font-medium transition ${
              activeTab === 'VI'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Voltage & Current
          </button>
          <button
            onClick={() => setActiveTab('TR')}
            className={`px-3 py-1 rounded-lg font-mono font-medium transition ${
              activeTab === 'TR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Temp & Resistance
          </button>
          <button
            onClick={() => setActiveTab('SOC')}
            className={`px-3 py-1 rounded-lg font-mono font-medium transition ${
              activeTab === 'SOC'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SoC (%)
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.6} />
            <XAxis dataKey="timestamp" stroke="#64748b" fontSize={11} tickLine={false} />
            
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '0.75rem',
                color: '#f8fafc',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '8px', fontSize: '11px', fontFamily: 'monospace' }} />

            {activeTab === 'VI' && (
              <>
                <YAxis yAxisId="v" orientation="left" domain={['dataMin - 10', 'dataMax + 10']} stroke="#22d3ee" fontSize={11} />
                <YAxis yAxisId="i" orientation="right" domain={['dataMin - 20', 'dataMax + 20']} stroke="#f43f5e" fontSize={11} />
                <Line
                  yAxisId="v"
                  type="monotone"
                  dataKey="voltage"
                  name="Voltage (V)"
                  stroke="#22d3ee"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  yAxisId="i"
                  type="monotone"
                  dataKey="current"
                  name="Current (A)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </>
            )}

            {activeTab === 'TR' && (
              <>
                <YAxis yAxisId="t" orientation="left" domain={['dataMin - 5', 'dataMax + 5']} stroke="#fbbf24" fontSize={11} />
                <YAxis yAxisId="r" orientation="right" domain={['dataMin - 2', 'dataMax + 5']} stroke="#a855f7" fontSize={11} />
                <Line
                  yAxisId="t"
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#fbbf24"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  yAxisId="r"
                  type="monotone"
                  dataKey="internalResistance"
                  name="Internal Resistance (mΩ)"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </>
            )}

            {activeTab === 'SOC' && (
              <>
                <YAxis yAxisId="soc" domain={[0, 100]} stroke="#34d399" fontSize={11} />
                <Line
                  yAxisId="soc"
                  type="monotone"
                  dataKey="soc"
                  name="State of Charge (%)"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Live Data Ticker Footbar */}
      <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono text-slate-400">
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
          <span className="text-[10px] text-slate-400 uppercase block">Instant Power</span>
          <span className="text-white font-bold">{currentTelemetry.powerKw || 0} kW</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
          <span className="text-[10px] text-slate-400 uppercase block">Terminal Voltage</span>
          <span className="text-cyan-400 font-bold">{currentTelemetry.voltage} V</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
          <span className="text-[10px] text-slate-400 uppercase block">Pack Load Current</span>
          <span className="text-rose-400 font-bold">{currentTelemetry.current} A</span>
        </div>
        <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800/40">
          <span className="text-[10px] text-slate-400 uppercase block">Cell Temp</span>
          <span className="text-amber-400 font-bold">{currentTelemetry.temperature} °C</span>
        </div>
      </div>

    </div>
  );
};
