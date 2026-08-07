import React from 'react';
import { EVVehiclePreset, ScenarioPreset } from '../types';
import { Activity, Play, Pause, RefreshCw, Cpu, Zap, BatteryCharging, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  vehicles: EVVehiclePreset[];
  scenarios: ScenarioPreset[];
  selectedVehicleId: string;
  selectedScenarioId: string;
  isSimulating: boolean;
  simSpeed: number;
  onSelectVehicle: (id: string) => void;
  onSelectScenario: (id: string) => void;
  onToggleSimulation: () => void;
  onChangeSpeed: (speed: number) => void;
  onResetSimulation: () => void;
  onOpenDoctor: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  vehicles,
  scenarios,
  selectedVehicleId,
  selectedScenarioId,
  isSimulating,
  simSpeed,
  onSelectVehicle,
  onSelectScenario,
  onToggleSimulation,
  onChangeSpeed,
  onResetSimulation,
  onOpenDoctor
}) => {
  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  const currentScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  return (
    <header className="bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-40 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand Logo & Platform Title */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Zap className="h-5 w-5 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  AURA<span className="text-cyan-400 font-mono text-xs font-semibold px-1.5 py-0.5 bg-cyan-950/80 border border-cyan-800/50 rounded">BMS v2.5</span>
                </h1>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                  <Activity className="w-2.5 h-2.5 mr-1 animate-pulse" /> Live NASA Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400">AI EV Battery Intelligence Platform</p>
            </div>
          </div>

          {/* Mobile Doctor Trigger */}
          <button
            onClick={onOpenDoctor}
            className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-medium hover:bg-indigo-600/30 transition"
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
            AI Doctor
          </button>
        </div>

        {/* Vehicle & Scenario Selectors */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Vehicle Dropdown */}
          <div className="flex-1 sm:flex-initial min-w-[170px]">
            <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-0.5">
              EV Pack Architecture
            </label>
            <select
              value={selectedVehicleId}
              onChange={(e) => onSelectVehicle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.chemistry})
                </option>
              ))}
            </select>
          </div>

          {/* Scenario / Aging Profile Dropdown */}
          <div className="flex-1 sm:flex-initial min-w-[190px]">
            <label className="block text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-0.5">
              Aging Scenario / Stress Test
            </label>
            <select
              value={selectedScenarioId}
              onChange={(e) => onSelectScenario(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </div>

          {/* Simulation Controls */}
          <div className="flex items-center gap-1.5 pt-3 sm:pt-0">
            <button
              onClick={onToggleSimulation}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all shadow-sm ${
                isSimulating
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30'
              }`}
            >
              {isSimulating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isSimulating ? 'Pause' : 'Live Stream'}</span>
            </button>

            <button
              onClick={onResetSimulation}
              title="Reset Telemetry Step"
              className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Speed Toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5 text-[10px]">
              {[1, 2, 5].map((spd) => (
                <button
                  key={spd}
                  onClick={() => onChangeSpeed(spd)}
                  className={`px-2 py-0.5 rounded font-mono font-bold transition ${
                    simSpeed === spd ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Desktop Digital Doctor Button */}
            <button
              onClick={onOpenDoctor}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-200" />
              Digital Doctor AI
            </button>
          </div>
        </div>

      </div>
    </header>
  );
};
