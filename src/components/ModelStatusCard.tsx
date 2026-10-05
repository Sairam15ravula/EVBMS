/**
 * ModelStatusCard Component
 * Displays ML model loading status and performance metrics (MAE, RMSE, R²).
 * Fetches from /api/models/status endpoint.
 */
import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ModelMetrics {
  mae: number;
  rmse: number;
  r2: number;
}

interface ModelStatus {
  name: string;
  loaded: boolean;
  isFallback: boolean;
  metrics?: ModelMetrics;
  version?: string;
  algorithm?: string;
}

interface ModelStatusResponse {
  models: ModelStatus[];
  overallStatus: 'loaded' | 'fallback' | 'partial';
}

export const ModelStatusCard: React.FC = () => {
  const [status, setStatus] = useState<ModelStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/models/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ModelStatusResponse = await res.json();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch model status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusColor = (loaded: boolean, isFallback: boolean) => {
    if (!loaded) return 'text-red-400';
    if (isFallback) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const getStatusIcon = (loaded: boolean, isFallback: boolean) => {
    if (!loaded) return <AlertCircle size={14} className="text-red-400" />;
    if (isFallback) return <AlertCircle size={14} className="text-amber-400" />;
    return <CheckCircle size={14} className="text-emerald-400" />;
  };

  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 text-slate-400">
          <RefreshCw size={14} className="animate-spin" />
          <span className="text-xs font-mono">Loading model status...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle size={14} />
            <span className="text-xs font-mono">Model status unavailable</span>
          </div>
          <button
            onClick={fetchStatus}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-cyan-400" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            ML Model Status
          </span>
        </div>
        <button
          onClick={fetchStatus}
          className="text-slate-500 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className="space-y-2">
        {status.models.map((model) => (
          <div
            key={model.name}
            className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0"
          >
            <div className="flex items-center gap-2">
              {getStatusIcon(model.loaded, model.isFallback)}
              <div>
                <div className="text-xs font-mono text-white">{model.name}</div>
                {model.algorithm && (
                  <div className="text-[10px] font-mono text-slate-500">
                    {model.algorithm} v{model.version || '1.0.0'}
                  </div>
                )}
              </div>
            </div>

            {model.metrics && (
              <div className="flex gap-3 text-[10px] font-mono">
                <div className="text-center">
                  <div className="text-slate-500">MAE</div>
                  <div className="text-cyan-400">{model.metrics.mae.toFixed(4)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500">RMSE</div>
                  <div className="text-cyan-400">{model.metrics.rmse.toFixed(4)}</div>
                </div>
                <div className="text-center">
                  <div className="text-slate-500">R²</div>
                  <div className="text-cyan-400">{model.metrics.r2.toFixed(4)}</div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <div
          className={`w-2 h-2 rounded-full ${
            status.overallStatus === 'loaded'
              ? 'bg-emerald-400'
              : status.overallStatus === 'partial'
              ? 'bg-amber-400'
              : 'bg-red-400'
          }`}
        />
        <span className="text-[10px] font-mono text-slate-500 uppercase">
          {status.overallStatus === 'loaded'
            ? 'All models loaded'
            : status.overallStatus === 'partial'
            ? 'Partial fallback'
            : 'Fallback mode'}
        </span>
      </div>
    </div>
  );
};
