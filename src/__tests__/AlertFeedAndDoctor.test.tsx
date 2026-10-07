import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AlertFeed } from '../components/AlertFeed';
import { DigitalDoctorDrawer } from '../components/DigitalDoctorDrawer';
import { BatteryAnomaly, EVVehiclePreset, BatteryTelemetry, HealthMetrics } from '../types';

const mockAnomalies: BatteryAnomaly[] = [
  {
    id: 'anom-1',
    timestamp: '10:45:00',
    type: 'critical',
    title: 'CRITICAL_THERMAL: Overheating',
    message: 'Battery pack temperature reached 58.2°C exceeding critical safety boundary.',
    value: 58.2,
    threshold: 55.0,
    unit: '°C',
    leadTimeSeconds: 30,
    riskScore: 92.5,
  },
  {
    id: 'anom-2',
    timestamp: '10:44:15',
    type: 'warning',
    title: 'RESISTANCE_SPIKE: Impedance Jump',
    message: 'Internal resistance rose by +45% across cell bank 2.',
    value: 38.0,
    threshold: 35.0,
    unit: 'mΩ',
    leadTimeSeconds: 120,
    riskScore: 68.0,
  },
];

const mockVehicle: EVVehiclePreset = {
  id: 'veh-tesla-model3',
  name: 'Tesla Model 3 LR',
  chemistry: 'NMC',
  nominalVoltage: 350.0,
  capacityAh: 230.0,
  maxContinuousDischargeA: 400.0,
  cellsInSeries: 96,
  parallelStrings: 4,
  maxChargeRateC: 2.5,
  totalEnergyKwh: 82.0,
};

const mockTelemetry: BatteryTelemetry = {
  voltage: 375.4,
  current: -15.0,
  temperature: 28.0,
  soc: 72.0,
  soh: 91.0,
  rul_cycles: 640,
  power_kw: -5.6,
  cell_voltages: [3.91, 3.90, 3.92, 3.91],
  cell_temperatures: [28.0, 28.2, 28.1, 27.9],
  cell_imbalance_mv: 20.0,
  charge_cycles: 120,
  internal_resistance_mohm: 14.8,
  anomaly_score: 5.0,
  anomaly_detected: false,
};

const mockHealthMetrics: HealthMetrics = {
  soh: 91.0,
  capacityLossPercent: 9.0,
  internalResistanceIncreasePercent: 6.0,
  estimatedRemainingCycles: 640,
  estimatedRemainingYears: 5.2,
  degradationRatePercentPerYear: 1.5,
  riskLevel: 'LOW',
};

describe('AlertFeed Component', () => {
  it('renders empty zero faults state when no anomalies exist', () => {
    render(
      <AlertFeed
        anomalies={[]}
        onAskDoctorAboutAnomaly={vi.fn()}
      />
    );

    expect(screen.getByText(/Anomaly & Diagnostic Alert Feed/i)).toBeInTheDocument();
    expect(screen.getByText(/0 Active/i)).toBeInTheDocument();
    expect(screen.getByText(/Zero Active Faults/i)).toBeInTheDocument();
  });

  it('renders active alerts, severity badges, and triggers doctor callback', () => {
    const onAskDoctor = vi.fn();
    render(
      <AlertFeed
        anomalies={mockAnomalies}
        onAskDoctorAboutAnomaly={onAskDoctor}
      />
    );

    expect(screen.getByText(/2 Active/i)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL_THERMAL: Overheating/i)).toBeInTheDocument();
    expect(screen.getByText(/RESISTANCE_SPIKE: Impedance Jump/i)).toBeInTheDocument();

    const askButtons = screen.getAllByRole('button', { name: /Ask Digital Doctor/i });
    expect(askButtons.length).toBe(2);
    fireEvent.click(askButtons[0]);
    expect(onAskDoctor).toHaveBeenCalledWith(mockAnomalies[0]);
  });
});

describe('DigitalDoctorDrawer Component', () => {
  it('does not render content when isOpen is false', () => {
    render(
      <DigitalDoctorDrawer
        isOpen={false}
        onClose={vi.fn()}
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
      />
    );

    expect(screen.queryByText(/Digital Doctor AI/i)).not.toBeInTheDocument();
  });

  it('renders chat interface and quick prompt suggestions when isOpen is true', () => {
    const onClose = vi.fn();
    render(
      <DigitalDoctorDrawer
        isOpen={true}
        onClose={onClose}
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
      />
    );

    expect(screen.getByText(/Digital Doctor AI/i)).toBeInTheDocument();
    expect(screen.getByText(/TreeSHAP Grounded/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask about health, charging, or thermal warnings/i)).toBeInTheDocument();

    // Close button triggers onClose
    const closeBtn = screen.getByRole('button', { name: /close drawer/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
