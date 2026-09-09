import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, AlertTriangle, Cpu, Flame, Layers, ShieldAlert, Thermometer, Zap, X } from 'lucide-react';
import { generateCellVoltages } from '../data/batteryData';

interface CellGridMonitorProps {
  cellCount?: number;
  chemistry?: 'NMC' | 'LFP';
  nominalVoltageV?: number;
  imbalanceMv?: number;
  vehicleName?: string;
}

interface CellData {
  cellId: number;
  voltage: number;
  temp: number;
  resistance: number;
}

export const CHEMISTRY_THRESHOLDS = {
  NMC: {
    maxVoltage: 4.20,
    minVoltage: 3.00,
    nominalVoltage: 3.70,
    maxDeltaMv: 50.0,
    criticalTemp: 55.0,
  },
  LFP: {
    maxVoltage: 3.65,
    minVoltage: 2.50,
    nominalVoltage: 3.20,
    maxDeltaMv: 60.0,
    criticalTemp: 60.0,
  },
};

export const CellGridMonitor: React.FC<CellGridMonitorProps> = ({
  cellCount = 96,
  chemistry = 'NMC',
  nominalVoltageV = 350,
  imbalanceMv = 15,
  vehicleName = 'EV Battery Pack',
}) => {
  const [viewMode, setViewMode] = useState<'voltage' | 'temperature'>('voltage');
  const [selectedCell, setSelectedCell] = useState<CellData | null>(null);

  const safeChemistry: 'NMC' | 'LFP' = chemistry === 'LFP' ? 'LFP' : 'NMC';
  const thresholds = CHEMISTRY_THRESHOLDS[safeChemistry];

  // Generate dynamic cell array based on cellCount and chemistry parameters
  const cells: CellData[] = useMemo(() => {
    return generateCellVoltages(nominalVoltageV, cellCount, safeChemistry, imbalanceMv);
  }, [nominalVoltageV, cellCount, safeChemistry, imbalanceMv]);

  // Statistics calculation
  const stats = useMemo(() => {
    const voltages = cells.map(c => c.voltage);
    const temps = cells.map(c => c.temp);

    const minV = Math.min(...voltages);
    const maxV = Math.max(...voltages);
    const avgV = voltages.reduce((a, b) => a + b, 0) / voltages.length;
    const deltaMv = (maxV - minV) * 1000.0;

    const maxT = Math.max(...temps);
    const avgT = temps.reduce((a, b) => a + b, 0) / temps.length;

    const imbalancedCells = cells.filter(c => Math.abs(c.voltage - avgV) * 1000.0 > thresholds.maxDeltaMv);

    return { minV, maxV, avgV, deltaMv, maxT, avgT, imbalancedCount: imbalancedCells.length };
  }, [cells, thresholds]);

  // Determine cell status styling
  const getCellColor = (cell: CellData) => {
    if (viewMode === 'temperature') {
      if (cell.temp >= thresholds.criticalTemp) {
        return 'bg-red-500/30 text-red-300 border-red-500/60 animate-pulse shadow-lg shadow-red-500/20';
      }
      if (cell.temp >= 38.0) {
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
      }
      return 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40 hover:bg-emerald-900/50';
    }

    // Voltage Mode
    if (cell.voltage >= thresholds.maxVoltage || cell.voltage <= thresholds.minVoltage) {
      return 'bg-red-500/30 text-red-300 border-red-500/60 animate-pulse shadow-lg shadow-red-500/20';
    }
    if (Math.abs(cell.voltage - stats.avgV) * 1000.0 > thresholds.maxDeltaMv) {
      return 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    }
    return 'bg-slate-900/80 text-slate-200 border-slate-800 hover:border-cyan-500/60 hover:bg-slate-850';
  };

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 text-slate-100 space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white tracking-tight">Cell-Level Monitoring Grid</h3>
            <span className="text-xs font-mono px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded-md">
              {cellCount} Cells ({chemistry})
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time individual cell voltage array & thermal hotspot heatmap ({vehicleName}).
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setViewMode('voltage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              viewMode === 'voltage' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Voltage (V)
          </button>
          <button
            onClick={() => setViewMode('temperature')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
              viewMode === 'temperature' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            Thermal (°C)
          </button>
        </div>
      </div>

      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[10px]">AVG CELL VOLTAGE</span>
          <span className="text-white font-bold text-base">{stats.avgV.toFixed(3)} V</span>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[10px]">CELL DELTA VARIANCE</span>
          <span className={`font-bold text-base ${stats.deltaMv > thresholds.maxDeltaMv ? 'text-amber-400' : 'text-emerald-400'}`}>
            {stats.deltaMv.toFixed(1)} mV
          </span>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[10px]">PEAK CELL TEMP</span>
          <span className={`font-bold text-base ${stats.maxT >= thresholds.criticalTemp ? 'text-red-400' : 'text-white'}`}>
            {stats.maxT.toFixed(1)} °C
          </span>
        </div>
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800">
          <span className="text-slate-400 block text-[10px]">IMBALANCED CELLS</span>
          <span className={`font-bold text-base ${stats.imbalancedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {stats.imbalancedCount} Cells
          </span>
        </div>
      </div>

      {/* Imbalance Alert Banner */}
      {stats.deltaMv > thresholds.maxDeltaMv && (
        <div className="flex items-center gap-2 p-3 bg-amber-950/40 border border-amber-900/60 rounded-xl text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Cell imbalance variance ({stats.deltaMv.toFixed(1)} mV) exceeds the {chemistry} threshold limit of {thresholds.maxDeltaMv} mV. Active BMS passive balancing recommended.
          </span>
        </div>
      )}

      {/* 96-Cell Grid Display */}
      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
        {cells.map((cell) => (
          <button
            key={cell.cellId}
            onClick={() => setSelectedCell(cell)}
            className={`p-2 rounded-xl border text-center transition-all cursor-pointer font-mono ${getCellColor(cell)}`}
          >
            <div className="text-[10px] opacity-60">#{cell.cellId}</div>
            <div className="text-xs font-bold mt-0.5">
              {viewMode === 'voltage' ? `${cell.voltage}V` : `${cell.temp}°C`}
            </div>
          </button>
        ))}
      </div>

      {/* Selected Cell Modal */}
      <AnimatePresence>
        {selectedCell && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 relative"
            >
              <button
                onClick={() => setSelectedCell(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-cyan-400 font-bold text-lg mb-4">
                <Cpu className="w-5 h-5" />
                <span>Cell #{selectedCell.cellId} Inspection</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Cell Voltage:</span>
                  <span className="text-white font-bold">{selectedCell.voltage} V</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Temperature:</span>
                  <span className="text-white font-bold">{selectedCell.temp} °C</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Internal Resistance:</span>
                  <span className="text-white font-bold">{selectedCell.resistance} mΩ</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">Voltage Delta to Avg:</span>
                  <span className="text-emerald-400 font-bold">
                    {((selectedCell.voltage - stats.avgV) * 1000.0).toFixed(1)} mV
                  </span>
                </div>
              </div>

              <button
                onClick={() => setSelectedCell(null)}
                className="w-full mt-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition"
              >
                Close Inspection
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
