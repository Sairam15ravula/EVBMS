import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { XaiAnalysisCard } from '../components/XaiAnalysisCard';
import { AIExplainResponse } from '../types';

describe('XaiAnalysisCard Component', () => {
  const mockAnalysis: AIExplainResponse = {
    summary: 'Battery pack operating nominally at 91.2% SoH.',
    degradationCauses: [
      { factor: 'Cycle Aging', impactPercentage: 55, description: 'Accumulated cyclic stress.' },
      { factor: 'Thermal Stress', impactPercentage: 45, description: 'Normal ambient cycling.' },
    ],
    healthDiagnosis: 'Battery is in GOOD operational condition.',
    riskAssessment: {
      level: 'LOW',
      thermalRunawayRisk: 'Low',
      lithiumPlatingRisk: 'Low',
      cellDegradationRisk: 'Consistent with benchmark',
    },
    actionPlan: ['Keep SoC between 20% and 80%'],
    estimatedRemainingYears: 5.8,
    soh_shap: {
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
    },
  };

  it('renders TreeSHAP Model Feature Attributions title and base value', () => {
    render(
      <XaiAnalysisCard
        analysis={mockAnalysis}
        isLoading={false}
        onRefreshXai={vi.fn()}
        onOpenDoctor={vi.fn()}
      />
    );

    expect(screen.getByText(/TreeSHAP Model Feature Attributions/i)).toBeInTheDocument();
    expect(screen.getByText(/Base Value E\[f\(X\)\]:/i)).toBeInTheDocument();
    expect(screen.getByText('0.8462')).toBeInTheDocument();
  });

  it('switches between SoH, RUL, and Anomaly tabs', () => {
    render(
      <XaiAnalysisCard
        analysis={mockAnalysis}
        isLoading={false}
        onRefreshXai={vi.fn()}
        onOpenDoctor={vi.fn()}
      />
    );

    const rulBtn = screen.getByRole('button', { name: /RUL \(Quantile\)/i });
    fireEvent.click(rulBtn);
    expect(screen.getByText(/rul_model_xgb/i)).toBeInTheDocument();

    const anomBtn = screen.getByRole('button', { name: /Anomaly/i });
    fireEvent.click(anomBtn);
    expect(screen.getByText(/telemetry_anomaly_model/i)).toBeInTheDocument();
  });

  it('calls onOpenDoctor when interactive chat link is clicked', () => {
    const onOpenDoctor = vi.fn();
    render(
      <XaiAnalysisCard
        analysis={mockAnalysis}
        isLoading={false}
        onRefreshXai={vi.fn()}
        onOpenDoctor={onOpenDoctor}
      />
    );

    const chatLink = screen.getByText(/Open Interactive Digital Doctor Chat/i);
    fireEvent.click(chatLink);
    expect(onOpenDoctor).toHaveBeenCalledTimes(1);
  });
});
