import React from 'react';
import { HealthMetrics, BatteryTelemetry, EVVehiclePreset } from '../types';
import { Zap, ShieldCheck, Battery, Thermometer, CheckCircle } from 'lucide-react';

interface SmartRecommendationsProps {
  telemetry: BatteryTelemetry;
  healthMetrics: HealthMetrics;
  vehicle: EVVehiclePreset;
  onOpenDoctor: () => void;
}

export const SmartRecommendations: React.FC<SmartRecommendationsProps> = ({
  telemetry,
  healthMetrics,
  vehicle,
  onOpenDoctor
}) => {
  // Generate rule-based battery preservation policies
  const recommendations: { title: string; desc: string; category: 'CHARGING' | 'THERMAL' | 'RANGE' }[] = [];

  if (telemetry.temperature > 40) {
    recommendations.push({
      title: 'Cool Down Before DC Fast Charging',
      desc: 'Pack temperature is currently elevated (> 40°C). Pause fast charging or allow active cooling before 150kW+ sessions to avoid cathodal structural degradation.',
      category: 'THERMAL'
    });
  } else if (telemetry.temperature < 5) {
    recommendations.push({
      title: 'Pre-Condition Battery Before Fast Charging',
      desc: 'Sub-zero temperatures increase internal impedance. Use the heat pump preconditioning mode to warm the pack to 20°C before plugging in to avoid lithium plating.',
      category: 'THERMAL'
    });
  }

  if (healthMetrics.soh < 85) {
    recommendations.push({
      title: 'Enforce 20% – 80% Daily SoC Buffer',
      desc: 'Your pack has entered the non-linear degradation zone. Keeping daily SoC within 20% to 80% reduces lattice mechanical strain and slows capacity fade by ~28%.',
      category: 'CHARGING'
    });
  } else {
    recommendations.push({
      title: 'Set Target Charge Limit to 80%',
      desc: 'For daily commuting, limit AC home charging to 80% SoC. Only charge to 100% immediately before long highway trips.',
      category: 'CHARGING'
    });
  }

  recommendations.push({
    title: 'Avoid Storing Vehicle at Low (< 10%) or High (> 90%) SoC',
    desc: 'High SoC increases chemical side-reaction rate at high ambient temps; ultra-low SoC risks copper current collector dissolution if uncharged for days.',
    category: 'RANGE'
  });

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Smart Operational Guidance & Preservation Policy
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            Automotive AI Rules
          </span>
        </div>

        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3.5 flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/50 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-200 font-mono mb-1">
                  {rec.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {rec.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
        <span className="text-slate-400">Customized for {vehicle.chemistry} Architecture</span>
        <button
          onClick={onOpenDoctor}
          className="text-cyan-400 hover:text-cyan-300 font-bold underline"
        >
          Ask AI Doctor For More Tips →
        </button>
      </div>
    </div>
  );
};
