import React, { useState } from 'react';
import { AIExplainResponse, ModelShapSummary } from '../types';
import { Cpu, RefreshCw, AlertTriangle, ShieldCheck, CheckCircle2, Sparkles, Zap, BarChart3 } from 'lucide-react';

const defaultSohShap: ModelShapSummary = {
  model_name: 'soh_model_xgb',
  base_value: 0.8462,
  prediction: 0.912,
  features: ['cycle', 'voltage', 'temperature'],
  attributions: { cycle: -0.052, voltage: 0.078, temperature: -0.009 },
  details: [
    { feature: 'cycle', value: 60, shap_attribution: -0.052, relative_importance_pct: 37.4 },
    { feature: 'voltage', value: 3.70, shap_attribution: 0.078, relative_importance_pct: 56.1 },
    { feature: 'temperature', value: 25.0, shap_attribution: -0.009, relative_importance_pct: 6.5 },
  ],
};

const defaultRulShap: ModelShapSummary = {
  model_name: 'rul_model_xgb (Quantile 50th)',
  base_value: 52.0,
  prediction: 68.4,
  features: ['cycle', 'voltage', 'temperature'],
  attributions: { cycle: -20.4, voltage: 34.8, temperature: -3.6 },
  details: [
    { feature: 'cycle', value: 60, shap_attribution: -20.4, relative_importance_pct: 34.7 },
    { feature: 'voltage', value: 3.70, shap_attribution: 34.8, relative_importance_pct: 59.2 },
    { feature: 'temperature', value: 25.0, shap_attribution: -3.6, relative_importance_pct: 6.1 },
  ],
};

const defaultAnomalyShap: ModelShapSummary = {
  model_name: 'telemetry_anomaly_model',
  base_value: -3.45,
  prediction: 0.045,
  features: ['soc', 'voltage', 'current', 'hour', 'dayofweek'],
  attributions: { soc: -1.2, voltage: -1.8, current: 3.2, hour: 0.4, dayofweek: -0.1 },
  details: [
    { feature: 'current', value: 20.0, shap_attribution: 3.2, relative_importance_pct: 47.8 },
    { feature: 'voltage', value: 3.70, shap_attribution: -1.8, relative_importance_pct: 26.9 },
    { feature: 'soc', value: 80.0, shap_attribution: -1.2, relative_importance_pct: 17.9 },
    { feature: 'hour', value: 12, shap_attribution: 0.4, relative_importance_pct: 6.0 },
    { feature: 'dayofweek', value: 2, shap_attribution: -0.1, relative_importance_pct: 1.4 },
  ],
};

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
  const [activeShapTab, setActiveShapTab] = useState<'soh' | 'rul' | 'anomaly'>('soh');
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

          {/* TreeSHAP Feature Attributions Section */}
          <div className="bg-slate-950/80 border border-indigo-900/40 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-slate-200 font-mono uppercase">
                  TreeSHAP Model Feature Attributions
                </h3>
              </div>
              <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setActiveShapTab('soh')}
                  className={`px-2.5 py-1 rounded transition ${
                    activeShapTab === 'soh'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  SoH (XGB)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShapTab('rul')}
                  className={`px-2.5 py-1 rounded transition ${
                    activeShapTab === 'rul'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  RUL (Quantile)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveShapTab('anomaly')}
                  className={`px-2.5 py-1 rounded transition ${
                    activeShapTab === 'anomaly'
                      ? 'bg-indigo-600 text-white font-bold shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Anomaly
                </button>
              </div>
            </div>

            {/* Render selected model's SHAP breakdown */}
            {(() => {
              const currentShap =
                activeShapTab === 'soh'
                  ? analysis.soh_shap || defaultSohShap
                  : activeShapTab === 'rul'
                  ? analysis.rul_shap || defaultRulShap
                  : analysis.anomaly_shap || defaultAnomalyShap;

              return (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span>
                      Model: <span className="text-indigo-300 font-bold">{currentShap.model_name}</span>
                    </span>
                    <span>
                      Base Value E[f(X)]: <span className="text-cyan-300 font-bold">{currentShap.base_value}</span>
                    </span>
                    <span>
                      Output f(X): <span className="text-emerald-300 font-bold">{currentShap.prediction}</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {currentShap.details.map((detail, idx) => {
                      const isPositive = detail.shap_attribution >= 0;
                      return (
                        <div key={idx} className="bg-slate-900/40 border border-slate-800/80 rounded-lg p-2.5">
                          <div className="flex items-center justify-between text-xs font-mono mb-1">
                            <span className="text-slate-300 font-bold capitalize">
                              {detail.feature}
                              <span className="text-slate-500 font-normal ml-2">
                                (Value: {detail.value})
                              </span>
                            </span>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono font-bold ${
                                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isPositive ? '+' : ''}
                                {detail.shap_attribution}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                ({detail.relative_importance_pct}%)
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 flex">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isPositive
                                  ? 'bg-gradient-to-r from-emerald-600 to-teal-400'
                                  : 'bg-gradient-to-r from-amber-500 to-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(5, detail.relative_importance_pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
