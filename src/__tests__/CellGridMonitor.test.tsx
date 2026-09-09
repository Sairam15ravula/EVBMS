import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CellGridMonitor, CHEMISTRY_THRESHOLDS } from '../components/CellGridMonitor';

describe('CellGridMonitor Component', () => {
  it('renders cell grid with specified cell count and chemistry', () => {
    render(<CellGridMonitor cellCount={96} chemistry="NMC" vehicleName="Tesla Model 3" />);
    expect(screen.getByText(/Cell-Level Monitoring Grid/i)).toBeInTheDocument();
    expect(screen.getByText(/96 Cells \(NMC\)/i)).toBeInTheDocument();
  });

  it('toggles between Voltage and Thermal heatmap views', () => {
    render(<CellGridMonitor cellCount={96} chemistry="NMC" />);
    const thermalBtn = screen.getByText(/Thermal \(°C\)/i);
    fireEvent.click(thermalBtn);
    expect(screen.getByText(/Thermal \(°C\)/i)).toHaveClass('bg-amber-500');
  });

  it('opens cell inspection modal on cell click', () => {
    render(<CellGridMonitor cellCount={96} chemistry="NMC" />);
    const cellBtn = screen.getByText('#1').closest('button');
    if (cellBtn) {
      fireEvent.click(cellBtn);
      expect(screen.getByText(/Cell #1 Inspection/i)).toBeInTheDocument();
    }
  });

  it('adapts thresholds dynamically for LFP chemistry', () => {
    expect(CHEMISTRY_THRESHOLDS.LFP.maxVoltage).toBe(3.65);
    expect(CHEMISTRY_THRESHOLDS.NMC.maxVoltage).toBe(4.20);
  });
});
