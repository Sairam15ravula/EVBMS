import React, { useState, useEffect } from 'react';
import { HealthMetrics, BatteryTelemetry, EVVehiclePreset, ChargingStrategyRecommendation } from '../types';
import { Zap, ShieldCheck, Battery, Thermometer, CheckCircle, ArrowRight, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';

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
  onOpenDoctor,
}) => {
  const [priorityMode, setPriorityMode] = useState<'protect_battery_life' | 'need_range_soon'>('protect_battery_life');
  const [recommendation, setRecommendation] = useState<ChargingStrategyRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Client-side rule engine mirror for instantaneous local responsiveness
  const computeLocalRecommendation = (
    mode: 'protect_battery_life' | 'need_range_soon'
  ): ChargingStrategyRecommendation => {
    const isRange = mode === 'need_range_soon';
    const isLfp = vehicle.chemistry?.toUpperCase().includes('LFP');
    const temp = telemetry.temperature;
    const soh = healthMetrics.soh;
    const soc = telemetry.soc;

    let targetMin = isRange ? 10 : 20;
    let targetMax = isRange ? (isLfp ? 100 : 95) : (isLfp ? 90 : 80);
    let rateKw = isRange ? Math.min(120, vehicle.maxChargingKw || 150) : 11;
    let chargeType = isRange ? `DC Fast (${rateKw} kW)` : `AC Level 2 (${rateKw} kW)`;
    const reasons: string[] = [];

    // Mode intent
    if (isRange) {
      reasons.push('Range Priority: Maximizing available highway range with high-power charging.');
    } else {
      reasons.push('Longevity Mode: Restricting daily cycling to 20%–80% buffer minimizes cathode lattice stress and slows SEI growth.');
    }

    // Chemistry
    if (isLfp) {
      if (isRange) {
        reasons.push('LFP cells tolerate 100% full top-up safely with minimal cathode microcracking.');
      } else {
        reasons.push('LFP chemistry has high structural stability; periodic 100% saturation is recommended for cell balancing.');
      }
    } else {
      if (!isRange) {
        reasons.push('NMC layered cathode suffers transition metal dissolution above 80% SoC; 80% daily ceiling enforced.');
      }
    }

    // SoH condition
    if (soh < 80) {
      if (!isRange) {
        targetMax = Math.min(targetMax, 75);
        rateKw = Math.min(rateKw, 7.4);
        chargeType = `AC Level 2 (Gentle, ${rateKw} kW)`;
        reasons.push(`Low SoH (${soh.toFixed(1)}%): Pack has heightened internal impedance. Daily charge window contracted to ${targetMin}%–${targetMax}% and power limited to ${rateKw} kW to reduce I²R heating.`);
      } else {
        targetMax = Math.min(targetMax, 85);
        rateKw = Math.min(rateKw, 50);
        chargeType = 'DC Fast (Capped at 50 kW for High Impedance)';
        reasons.push(`Degraded Pack (${soh.toFixed(1)}% SoH): Fast charge capped at 50 kW and max charge limited to 85% to protect degraded electrodes.`);
      }
    } else if (soh < 88 && isRange) {
      rateKw = Math.min(rateKw, 75);
      reasons.push(`Moderate degradation (SoH ${soh.toFixed(1)}%): Fast charge capped at 75 kW to curb heat buildup.`);
    }

    // Thermal overrides
    if (temp >= 42) {
      targetMax = Math.min(targetMax, isRange ? 80 : 75);
      rateKw = Math.min(rateKw, 7.4);
      chargeType = `AC Level 2 (Thermal Throttled, ${rateKw} kW)`;
      reasons.push(`HOT PACK OVERRIDE (${temp.toFixed(1)}°C >= 42°C): Fast charging disabled and rate throttled to 7.4 kW to prevent thermal runaway hazard. Allow cooling before high-power charging.`);
    } else if (temp >= 36) {
      if (isRange) {
        rateKw = Math.min(rateKw, 50);
        chargeType = 'DC Fast (Thermal Throttled, 50 kW)';
        reasons.push(`Elevated temperature (${temp.toFixed(1)}°C): Fast charge throttled to 50 kW to avoid exceeding 45°C limit.`);
      } else {
        rateKw = Math.min(rateKw, 11);
        reasons.push(`Warm pack (${temp.toFixed(1)}°C): AC slow charging recommended to avoid supplementary thermal accumulation.`);
      }
    } else if (temp < 5) {
      rateKw = Math.min(rateKw, 7.4);
      chargeType = `AC Level 2 (Cold Throttled, ${rateKw} kW)`;
      reasons.push(`COLD PACK OVERRIDE (${temp.toFixed(1)}°C < 5°C): Low temperature slows Li+ solid diffusion. Fast charging disabled to prevent metallic lithium plating. Preconditioning advised.`);
    }

    // Near-full SoC taper
    if (soc >= 95) {
      rateKw = Math.min(rateKw, 2.3);
      chargeType = 'AC Trickle / Balancing (2.3 kW)';
      reasons.push(`Near-Full Pack (${soc.toFixed(1)}% SoC): Power tapered to 2.3 kW trickle rate for cell balancing without overpotential stress.`);
    } else if (soc >= 85) {
      if (!isRange) {
        rateKw = Math.min(rateKw, 3.6);
        chargeType = 'AC Low (3.6 kW)';
        reasons.push(`Pack at ${soc.toFixed(1)}% SoC exceeds 80% daily ceiling. Disconnecting charge recommended unless departing immediately.`);
      } else {
        rateKw = Math.min(rateKw, 22);
        chargeType = 'DC Fast (CV Saturation Taper, 22 kW)';
        reasons.push(`Approaching capacity (${soc.toFixed(1)}% SoC): DC Fast rate tapered to 22 kW in CV phase.`);
      }
    }

    return {
      charging_class: !isRange && targetMax <= 82 ? 'optimal' : isRange ? 'fast_moderate' : 'standard',
      confidence: 0.95,
      source: 'rule_engine',
      target_soc_min: targetMin,
      target_soc_max: targetMax,
      target_soc_window: [targetMin, targetMax],
      suggested_charge_rate_kw: rateKw,
      suggested_charge_type: chargeType,
      priority_mode: mode,
      reason: reasons.join(' '),
      explanation_link: '#digital-doctor',
    };
  };

  // Sync recommendation from FastAPI backend /predict/charging
  useEffect(() => {
    let isMounted = true;
    const local = computeLocalRecommendation(priorityMode);
    setRecommendation(local);

    const fetchBackendRecommendation = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/predict/charging', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            soc: telemetry.soc,
            soh: healthMetrics.soh,
            temperature: telemetry.temperature,
            battery_type: vehicle.chemistry || 'NMC',
            priority_mode: priorityMode,
            current_mode: 'AC',
          }),
        });

        if (res.ok && isMounted) {
          const data: ChargingStrategyRecommendation = await res.json();
          setRecommendation(data);
        }
      } catch (err) {
        // Graceful fallback to local computation
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBackendRecommendation();

    return () => {
      isMounted = false;
    };
  }, [priorityMode, telemetry.soc, telemetry.temperature, healthMetrics.soh, vehicle.chemistry]);

  const rec = recommendation || computeLocalRecommendation(priorityMode);

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4">
      {/* Header & Mode Selector */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Charging Strategy & Preservation Policy
            </h2>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            {rec.source === 'trained_model' ? 'XGBoost + Physics' : 'AI Battery Rules'}
          </span>
        </div>

        {/* Priority Mode Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            onClick={() => setPriorityMode('protect_battery_life')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
              priorityMode === 'protect_battery_life'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Protect Battery Life
          </button>
          <button
            onClick={() => setPriorityMode('need_range_soon')}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-mono font-bold transition-all ${
              priorityMode === 'need_range_soon'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Need Range Soon
          </button>
        </div>
      </div>

      {/* Concrete Strategy Recommendation Card */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Recommended Charging Strategy
          </span>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
              priorityMode === 'protect_battery_life'
                ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
            }`}
          >
            {priorityMode === 'protect_battery_life' ? 'LONGEVITY MODE' : 'RANGE MODE'}
          </span>
        </div>

        {/* Metric Pills: Window & Rate */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono mb-1">
              <Battery className="w-3.5 h-3.5 text-cyan-400" />
              Target SoC Window
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {rec.target_soc_min}% – {rec.target_soc_max}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              Current SoC: {telemetry.soc.toFixed(0)}%
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-mono mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Suggested Rate
            </div>
            <div className="text-lg font-bold text-white font-mono">
              {rec.suggested_charge_rate_kw} kW
            </div>
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {rec.suggested_charge_type}
            </div>
          </div>
        </div>

        {/* Visual Target Window Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] font-mono text-slate-500">
            <span>0%</span>
            <span className="text-cyan-400 font-bold">Recommended: {rec.target_soc_min}% – {rec.target_soc_max}%</span>
            <span>100%</span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative">
            {/* Target Window Band */}
            <div
              className={`h-full absolute rounded-full ${
                priorityMode === 'protect_battery_life' ? 'bg-emerald-500/70' : 'bg-amber-500/70'
              }`}
              style={{
                left: `${rec.target_soc_min}%`,
                width: `${rec.target_soc_max - rec.target_soc_min}%`,
              }}
            />
            {/* Current SoC indicator */}
            <div
              className="h-full w-1 bg-white absolute shadow-sm"
              style={{ left: `${Math.min(99, Math.max(1, telemetry.soc))}%` }}
              title={`Current SoC: ${telemetry.soc.toFixed(0)}%`}
            />
          </div>
        </div>

        {/* Plain-Language Rationale */}
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-lg p-3 text-xs leading-relaxed text-slate-300">
          <div className="text-[11px] font-mono font-bold text-slate-400 mb-1 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-cyan-400" />
            Decision Rationale (SoH {healthMetrics.soh.toFixed(1)}% · Temp {telemetry.temperature.toFixed(1)}°C)
          </div>
          <p className="text-slate-300 text-xs">
            {rec.reason}
          </p>
        </div>

        {/* Link to Explanation */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-[11px] font-mono text-slate-500">
            Based on {vehicle.chemistry} chemical kinetics
          </span>
          <button
            onClick={onOpenDoctor}
            className="text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1 font-mono hover:underline"
          >
            Ask AI Doctor for Explanation <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
