/**
 * Data Export Utilities
 * Provides CSV, JSON, and specialized telemetry export functions.
 */
import { BatteryTelemetry } from '../types';

/**
 * Triggers a browser download for a given blob and filename.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a CSV field value to handle commas, quotes, and newlines.
 */
function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of objects to CSV format and triggers a download.
 */
export function exportToCSV(data: Record<string, unknown>[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn('exportToCSV: No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = data.map((row) =>
    headers.map((header) => escapeCsvField(row[header])).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Exports data as a formatted JSON file and triggers a download.
 */
export function exportToJSON(data: unknown, filename: string): void {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  triggerDownload(blob, filename);
}

/**
 * Specialized telemetry history export with proper headers.
 * Flattens BatteryTelemetry objects into a CSV with descriptive column names.
 */
export function exportTelemetryHistory(telemetry: BatteryTelemetry[]): void {
  if (!telemetry || telemetry.length === 0) {
    console.warn('exportTelemetryHistory: No telemetry data to export');
    return;
  }

  const headers = [
    'Timestamp',
    'Voltage (V)',
    'Current (A)',
    'Temperature (°C)',
    'State of Charge (%)',
    'Internal Resistance (mΩ)',
    'Cycle Count',
    'Nominal Capacity (Ah)',
    'Current Capacity (Ah)',
    'Cell Imbalance (mV)',
    'Power (kW)',
  ];

  const rows = telemetry.map((t) =>
    [
      t.timestamp,
      t.voltage,
      t.current,
      t.temperature,
      t.soc,
      t.internalResistance,
      t.cycleCount,
      t.nominalCapacity,
      t.currentCapacity,
      t.cellImbalance ?? '',
      t.powerKw ?? '',
    ]
      .map((val) => escapeCsvField(val))
      .join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, `telemetry_history_${new Date().toISOString().slice(0, 10)}.csv`);
}
