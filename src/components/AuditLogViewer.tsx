/**
 * AuditLogViewer Component
 * Displays recent audit logs in a table with filtering and pagination.
 * Fetches from /api/audit/logs endpoint.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter, RefreshCw } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  method: string;
  endpoint: string;
  statusCode: number;
  ipAddress: string;
  details?: string;
}

interface AuditLogResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface AuditLogFilters {
  user: string;
  method: string;
  startDate: string;
  endDate: string;
}

const PAGE_SIZE = 15;

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AuditLogFilters>({
    user: '',
    method: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (filters.user) params.set('user', filters.user);
      if (filters.method) params.set('method', filters.method);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);

      const res = await fetch(`/api/audit/logs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AuditLogResponse = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET': return 'text-emerald-400 bg-emerald-950/50';
      case 'POST': return 'text-cyan-400 bg-cyan-950/50';
      case 'PUT': return 'text-amber-400 bg-amber-950/50';
      case 'DELETE': return 'text-red-400 bg-red-950/50';
      default: return 'text-slate-400 bg-slate-800';
    }
  };

  const getStatusColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-emerald-400';
    if (code >= 300 && code < 400) return 'text-cyan-400';
    if (code >= 400 && code < 500) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-cyan-400" />
          <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
            Audit Logs
          </span>
          <span className="text-[10px] font-mono text-slate-600">
            ({total} entries)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              showFilters
                ? 'border-cyan-800 text-cyan-400 bg-cyan-950/30'
                : 'border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            Filters
          </button>
          <button
            onClick={fetchLogs}
            className="text-slate-500 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pb-2 border-b border-slate-800/60">
          <input
            type="text"
            placeholder="Filter by user..."
            value={filters.user}
            onChange={(e) => handleFilterChange('user', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-800"
          />
          <select
            value={filters.method}
            onChange={(e) => handleFilterChange('method', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-800"
          >
            <option value="">All Methods</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
          </select>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-800"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-800"
          />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="text-xs text-red-400 font-mono py-2">{error}</div>
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500 font-mono border-b border-slate-800/60">
                <th className="pb-2 pr-3">Timestamp</th>
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Method</th>
                <th className="pb-2 pr-3">Endpoint</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-slate-600 py-4 font-mono">
                    No audit logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors"
                  >
                    <td className="py-2 pr-3 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-white whitespace-nowrap">
                      {log.userName || log.userId}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${getMethodColor(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-400 max-w-[200px] truncate">
                      {log.endpoint}
                    </td>
                    <td className={`py-2 pr-3 font-mono font-bold ${getStatusColor(log.statusCode)}`}>
                      {log.statusCode}
                    </td>
                    <td className="py-2 font-mono text-slate-500">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-2 text-slate-400 py-4">
          <RefreshCw size={12} className="animate-spin" />
          <span className="text-xs font-mono">Loading audit logs...</span>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
          <span className="text-[10px] font-mono text-slate-500">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={12} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
