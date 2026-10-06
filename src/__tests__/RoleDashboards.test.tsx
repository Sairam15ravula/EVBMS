import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { EvOwnerDashboard } from '../components/views/EvOwnerDashboard';
import { FleetOperatorDashboard } from '../components/views/FleetOperatorDashboard';
import { ServiceCenterDashboard } from '../components/views/ServiceCenterDashboard';
import { TimeSeriesTrendCharts } from '../components/TimeSeriesTrendCharts';
import { EVVehiclePreset, BatteryTelemetry, HealthMetrics } from '../types';

// Mock ResizeObserver for Recharts
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
  current: -42.5,
  temperature: 28.5,
  soc: 74.2,
  soh: 91.5,
  rul_cycles: 640,
  rul_lower_90: 580,
  rul_upper_90: 710,
  power_kw: -15.9,
  cell_voltages: [3.91, 3.90, 3.92, 3.91],
  cell_temperatures: [28.2, 28.5, 28.6, 28.4],
  cell_imbalance_mv: 20.0,
  charge_cycles: 120,
  internal_resistance_mohm: 14.8,
  anomaly_score: 4.5,
  anomaly_detected: false,
};

const mockHealthMetrics: HealthMetrics = {
  soh: 91.5,
  capacityLossPercent: 8.5,
  internalResistanceIncreasePercent: 6.2,
  estimatedRemainingCycles: 640,
  estimatedRemainingYears: 5.4,
  degradationRatePercentPerYear: 1.5,
  riskLevel: 'LOW',
  rulCycles: 640,
  rulYears: 5.4,
};

describe('EvOwnerDashboard Component', () => {
  it('renders EV owner banner, vehicle info, and telemetry metrics', () => {
    const onOpenDoctor = vi.fn();
    render(
      <EvOwnerDashboard
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={onOpenDoctor}
      />
    );

    expect(screen.getByText(/EV OWNER DASHBOARD/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Tesla Model 3 LR/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/My Battery Health & Operational Advisory/i)).toBeInTheDocument();
    expect(screen.getAllByText('91.5%').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('74.2%').length).toBeGreaterThanOrEqual(1);
  });

  it('triggers Digital Doctor callback when requested from owner view', () => {
    const onOpenDoctor = vi.fn();
    render(
      <EvOwnerDashboard
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={onOpenDoctor}
      />
    );

    const askDoctorBtn = screen.getByRole('button', { name: /Consult Digital Doctor/i });
    fireEvent.click(askDoctorBtn);
    expect(onOpenDoctor).toHaveBeenCalledWith('Give me a full diagnostic checkup of my EV battery pack.');
  });
});

describe('FleetOperatorDashboard Component', () => {
  it('renders fleet KPIs and ranks vehicles by risk score', () => {
    render(<FleetOperatorDashboard />);

    expect(screen.getByText(/FLEET OPERATOR CONTROL CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/Commercial Fleet Size/i)).toBeInTheDocument();
    expect(screen.getByText(/Fleet Average SoH/i)).toBeInTheDocument();
    expect(screen.getByText(/All Vehicles Ranked by Predictive Risk/i)).toBeInTheDocument();

    // Verify Nissan Leaf and F-150 in the table
    expect(screen.getAllByText(/Nissan Leaf Gen2 #05/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Ford F-150 Lightning #04/i).length).toBeGreaterThanOrEqual(1);
  });

  it('allows filtering fleet vehicles by risk status button', () => {
    render(<FleetOperatorDashboard />);

    const criticalFilterBtn = screen.getByRole('button', { name: /^critical$/i });
    fireEvent.click(criticalFilterBtn);

    // Should still show Nissan Leaf (critical)
    expect(screen.getAllByText(/Nissan Leaf Gen2 #05/i).length).toBeGreaterThanOrEqual(1);
  });

  it('handles service dispatch action on a flagged vehicle', () => {
    render(<FleetOperatorDashboard />);

    const dispatchBtns = screen.getAllByRole('button', { name: /Dispatch Service/i });
    expect(dispatchBtns.length).toBeGreaterThan(0);
    fireEvent.click(dispatchBtns[0]);

    // Should indicate dispatched status
    expect(screen.getAllByText(/Dispatched/i).length).toBeGreaterThan(0);
  });
});

describe('ServiceCenterDashboard Component', () => {
  it('renders diagnostic center header and switches to anomaly history', () => {
    const onOpenDoctor = vi.fn();
    render(
      <ServiceCenterDashboard
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={onOpenDoctor}
      />
    );

    expect(screen.getByText(/SERVICE CENTER & DIAGNOSTIC LAB/i)).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic Scan, Cell Grid & Anomaly History/i)).toBeInTheDocument();

    // Switch to Anomaly History tab
    const anomTab = screen.getByRole('button', { name: /Anomaly History/i });
    fireEvent.click(anomTab);

    expect(screen.getByText(/Diagnostic Anomaly History & Lead-Time Log/i)).toBeInTheDocument();
    expect(screen.getByText(/CRITICAL_HAZARD/i)).toBeInTheDocument();
    expect(screen.getByText(/45s/i)).toBeInTheDocument();
  });

  it('switches between diagnostic tabs and renders degradation trends', () => {
    const onOpenDoctor = vi.fn();
    render(
      <ServiceCenterDashboard
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={onOpenDoctor}
      />
    );

    const trendsTab = screen.getByRole('button', { name: /Degradation Trends/i });
    fireEvent.click(trendsTab);
    expect(screen.getByText(/Time-Series Trend Analytics/i)).toBeInTheDocument();

    const cellsTab = screen.getByRole('button', { name: /Cell Heatmap Grid/i });
    fireEvent.click(cellsTab);
    expect(screen.getByText(/Cell-Level Monitoring Grid/i)).toBeInTheDocument();
  });
});

describe('TimeSeriesTrendCharts Component', () => {
  it('renders degradation trajectory title and switches tabs', () => {
    render(
      <TimeSeriesTrendCharts
        currentCycle={120}
        currentSoh={91.5}
        currentRul={640}
        vehicleName="Tesla Model 3 LR"
      />
    );

    expect(screen.getByText(/Time-Series Trend Analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/Tesla Model 3 LR/i)).toBeInTheDocument();

    // Switch to RUL Forecast tab
    const rulTab = screen.getByRole('button', { name: /RUL \(90% Interval\)/i });
    fireEvent.click(rulTab);
    expect(screen.getByText(/Quantile RUL forecast/i)).toBeInTheDocument();

    // Switch to Voltage & Temp tab
    const vtTab = screen.getByRole('button', { name: /Voltage & Temp/i });
    fireEvent.click(vtTab);
    expect(screen.getByText(/Multi-cycle terminal voltage/i)).toBeInTheDocument();
  });
});
