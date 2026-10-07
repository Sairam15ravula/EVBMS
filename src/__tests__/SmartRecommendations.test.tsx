import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SmartRecommendations } from '../components/SmartRecommendations';
import { EVVehiclePreset, BatteryTelemetry, HealthMetrics } from '../types';

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
  current: 0.0,
  temperature: 26.5,
  soc: 65.0,
  soh: 91.5,
  rul_cycles: 640,
  power_kw: 0.0,
  cell_voltages: [3.91, 3.90, 3.92, 3.91],
  cell_temperatures: [26.2, 26.5, 26.6, 26.4],
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
};

describe('SmartRecommendations Component', () => {
  it('renders header, target window, and default longevity mode', () => {
    render(
      <SmartRecommendations
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={vi.fn()}
      />
    );

    expect(screen.getByText(/Charging Strategy & Preservation Policy/i)).toBeInTheDocument();
    expect(screen.getByText(/Protect Battery Life/i)).toBeInTheDocument();
    expect(screen.getByText(/Need Range Soon/i)).toBeInTheDocument();
    expect(screen.getByText(/Target SoC Window/i)).toBeInTheDocument();
    expect(screen.getAllByText(/20% – 80%/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches between Protect Battery Life and Need Range Soon modes', () => {
    render(
      <SmartRecommendations
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={vi.fn()}
      />
    );

    const rangeBtn = screen.getByRole('button', { name: /Need Range Soon/i });
    fireEvent.click(rangeBtn);

    // In Need Range Soon mode for NMC, target window expands up to 95%
    expect(screen.getAllByText(/10% – 95%/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/DC Fast/i)).toBeInTheDocument();

    // Switch back to longevity mode
    const lifeBtn = screen.getByRole('button', { name: /Protect Battery Life/i });
    fireEvent.click(lifeBtn);
    expect(screen.getAllByText(/20% – 80%/i).length).toBeGreaterThanOrEqual(1);
  });

  it('enforces thermal safety throttling override on high pack temperature', () => {
    const hotTelemetry: BatteryTelemetry = {
      ...mockTelemetry,
      temperature: 46.5, // > 42°C threshold
    };

    render(
      <SmartRecommendations
        vehicle={mockVehicle}
        telemetry={hotTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={vi.fn()}
      />
    );

    expect(screen.getByText(/HOT PACK OVERRIDE/i)).toBeInTheDocument();
    expect(screen.getByText(/Thermal Throttled/i)).toBeInTheDocument();
  });

  it('invokes onOpenDoctor when explanation button is clicked', () => {
    const onOpenDoctor = vi.fn();
    render(
      <SmartRecommendations
        vehicle={mockVehicle}
        telemetry={mockTelemetry}
        healthMetrics={mockHealthMetrics}
        onOpenDoctor={onOpenDoctor}
      />
    );

    const askDoctorBtn = screen.getByText(/Ask AI Doctor for Explanation/i);
    fireEvent.click(askDoctorBtn);
    expect(onOpenDoctor).toHaveBeenCalledTimes(1);
  });
});
