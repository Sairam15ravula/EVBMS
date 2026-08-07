import React from 'react';
import { AIExplainResponse } from '../types';
import { Cpu, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Sparkles, Zap } from 'lucide-react';

interface XaiAnalysisCardProps {
  analysis: AIExplainResponse | null;
  isLoading: boolean;
  onRefreshXai: () => void;
  onOpenDoctor: () => void;
}

export const XaiAnalysisCard: React.FC<XaiAnalysisCardProps> = ({
  analysis,
  isLoading,
  onRefreshXai,
  onOpenDoctor
}) => {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 border border-indigo-500/30 rounded-2xl p-5 shadow-xl shadow-indigo-950/20 relative overflow-hidden">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-indigo-800/40">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-300">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Explainable AI (XAI) "Digital Doctor" Diagnosis
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                Gemini 3.6 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Root-cause battery physics analysis & predictive operational recommendations
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshXai}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-mono font-medium transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Analyzing...' : 'Run AI XAI Diagnostic'}
        </button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <Cpu className="w-8 h-8 text-indigo-400 animate-bounce mx-auto mb-2" />
          <p className="text-sm font-mono text-indigo-300 font-bold">
            Synthesizing NASA B0005 & CALCE Aging Telemetry...
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Gemini is calculating SEI growth vectors and thermal stress degradation factors.
          </p>
        </div>
      ) : !analysis ? (
        <div className="py-8 text-center">
          <p className="text-xs text-slate-400 mb-3 font-mono">
            Click to run Gemini XAI diagnosis on current EV pack telemetry.
          </p>
          <button
            onClick={onRefreshXai}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition"
          >
            Generate AI Diagnosis
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          
          {/* Executive Summary & Diagnosis */}
          <div className="bg-slate-950/80 border border-indigo-900/40 rounded-xl p-4">
            <h3 className="text-xs font-bold text-indigo-300 font-mono uppercase mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Executive Diagnosis
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed font-sans mb-2">
              {analysis.summary}
            </p>
            <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 font-mono">
              <strong className="text-indigo-400">Health State:</strong> {analysis.healthDiagnosis}
            </p>
          </div>

          {/* Degradation Causes Percentage Breakdown */}
          <div>
            <h3 className="text-xs font-bold text-slate-300 font-mono uppercase mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Calculated Degradation Drivers
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.degradationCauses.map((cause, idx) => (
                <div key={idx} className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1.5 font-mono">
                    <span className="text-xs font-bold text-slate-200 line-clamp-1" title={cause.factor}>
                      {cause.factor}
                    </span>
                    <span className="text-xs font-bold text-amber-400 ml-2 shrink-0">
                      {cause.impactPercentage}%
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden mb-2 border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                      style={{ width: `${cause.impactPercentage}%` }}
                    />
                  </div>

                  <p className="text-[11px] text-slate-400 leading-snug">
                    {cause.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Matrix & Action Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Risk Matrix */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 font-mono text-xs">
              <h4 className="text-xs font-bold text-slate-300 uppercase mb-2.5 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Safety Risk Matrix
              </h4>

              <div className="space-y-2">
                <div className="flex items-start justify-between pb-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Thermal Runaway:</span>
                  <span className="text-slate-200 text-right ml-2">{analysis.riskAssessment.thermalRunawayRisk}</span>
                </div>
                <div className="flex items-start justify-between pb-1.5 border-b border-slate-900">
                  <span className="text-slate-400">Lithium Plating:</span>
                  <span className="text-slate-200 text-right ml-2">{analysis.riskAssessment.lithiumPlatingRisk}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-slate-400">Cell Degradation:</span>
                  <span className="text-slate-200 text-right ml-2">{analysis.riskAssessment.cellDegradationRisk}</span>
                </div>
              </div>
            </div>

            {/* Action Plan */}
            <div className="bg-slate-950/80 border border-indigo-900/40 rounded-xl p-3.5 text-xs">
              <h4 className="text-xs font-bold text-indigo-300 font-mono uppercase mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Life-Extending Action Plan
              </h4>

              <ul className="space-y-2">
                {analysis.actionPlan.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-slate-300">
                    <span className="text-emerald-400 font-mono font-bold shrink-0">{i + 1}.</span>
                    <span className="leading-snug">{action}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* Footer trigger to open Chatbot */}
          <div className="pt-2 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400">
              Est. Remaining Pack Life: <span className="text-indigo-300 font-bold">{analysis.estimatedRemainingYears} Years</span>
            </span>
            <button
              onClick={onOpenDoctor}
              className="text-indigo-400 hover:text-indigo-300 font-bold underline flex items-center gap-1"
            >
              Open Interactive Digital Doctor Chat →
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
