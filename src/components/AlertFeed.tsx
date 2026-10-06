import React from 'react';
import { BatteryAnomaly } from '../types';
import { ShieldAlert, AlertCircle, Info, MessageSquareCode, ArrowRight } from 'lucide-react';

interface AlertFeedProps {
  anomalies: BatteryAnomaly[];
  onAskDoctorAboutAnomaly: (anomaly: BatteryAnomaly) => void;
}

export const AlertFeed: React.FC<AlertFeedProps> = ({
  anomalies = [],
  onAskDoctorAboutAnomaly
}) => {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between h-full">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            Anomaly & Diagnostic Alert Feed
          </h2>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800">
          {anomalies.length} Active
        </span>
      </div>

      {/* Alerts List */}
      <div className="space-y-3 overflow-y-auto max-h-[320px] pr-1">
        {anomalies.length === 0 ? (
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-6 text-center">
            <div className="w-8 h-8 rounded-full bg-emerald-950/80 text-emerald-400 flex items-center justify-center mx-auto mb-2 border border-emerald-800/60">
              ✓
            </div>
            <p className="text-xs font-mono text-emerald-300 font-bold mb-1">
              Zero Active Faults
            </p>
            <p className="text-xs text-slate-400">
              Pack operates within nominal voltage, current, and temperature bounds.
            </p>
          </div>
        ) : (
          anomalies.map((anom) => {
            const isCrit = anom.severity === 'CRITICAL';
            const isWarn = anom.severity === 'WARNING';

            return (
              <div
                key={anom.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCrit
                    ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                    : isWarn
                    ? 'bg-amber-950/30 border-amber-800/80 text-amber-200'
                    : 'bg-slate-950/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {isCrit ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : isWarn ? (
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold font-mono">
                      {anom.title}
                    </span>
                  </div>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase border ${
                    isCrit ? 'bg-rose-950 text-rose-400 border-rose-800' :
                    isWarn ? 'bg-amber-950 text-amber-400 border-amber-800' :
                    'bg-cyan-950 text-cyan-400 border-cyan-800'
                  }`}>
                    {anom.severity}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mb-2 leading-relaxed">
                  {anom.description}
                </p>

                {/* Predictive early-warning indicators */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {anom.riskLevel && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase border ${
                      anom.riskLevel === 'critical'
                        ? 'bg-rose-950/80 text-rose-300 border-rose-700/60'
                        : anom.riskLevel === 'watch'
                        ? 'bg-amber-950/80 text-amber-300 border-amber-700/60'
                        : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
                    }`}>
                      Risk: {anom.riskLevel}
                    </span>
                  )}
                  {anom.anomalyScore != null && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-700">
                      Score: {anom.anomalyScore.toFixed(1)}/100
                    </span>
                  )}
                  {anom.estimatedLeadTimeSeconds != null && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                      Est. Lead-Time: ~{Math.round(anom.estimatedLeadTimeSeconds)}s
                    </span>
                  )}
                </div>

                {anom.contributingSignals && anom.contributingSignals.length > 0 && (
                  <div className="mb-2 p-2 rounded bg-slate-950/70 border border-slate-800/80 text-[11px] font-mono text-slate-300">
                    <span className="text-slate-500 font-semibold uppercase tracking-wider text-[9px] block mb-1">Contributing Signals:</span>
                    <ul className="list-disc list-inside space-y-0.5 text-slate-300">
                      {anom.contributingSignals.map((sig, idx) => (
                        <li key={idx}>{sig}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] font-mono pt-2 border-t border-slate-800/60 gap-2">
                  <div className="text-slate-400">
                    Value: <span className="text-white font-bold">{anom.value}</span> (Threshold: {anom.threshold})
                  </div>

                  <button
                    onClick={() => onAskDoctorAboutAnomaly(anom)}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-semibold text-[11px] hover:underline"
                  >
                    <MessageSquareCode className="w-3 h-3" /> Ask Digital Doctor
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
};
