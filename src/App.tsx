import React, { useState, useEffect, useRef } from 'react';
import { EVVehiclePreset, ScenarioPreset, BatteryTelemetry, HealthMetrics, DegradationPoint, AIExplainResponse, BatteryAnomaly } from './types';
import { Header } from './components/Header';
import { MetricCards } from './components/MetricCards';
import { TelemetryChart } from './components/TelemetryChart';
import { DegradationChart } from './components/DegradationChart';
import { BmsComparison } from './components/BmsComparison';
import { AlertFeed } from './components/AlertFeed';
import { XaiAnalysisCard } from './components/XaiAnalysisCard';
import { SmartRecommendations } from './components/SmartRecommendations';
import { DigitalDoctorDrawer } from './components/DigitalDoctorDrawer';
import { VEHICLE_PRESETS, SCENARIO_PRESETS, generateLiveTelemetryFrame, generateDegradationCurve } from './data/batteryData';
import { calculateHealthMetrics } from './utils/analyticsEngine';

export default function App() {
  // Presets & Selection
  const [vehicles] = useState<EVVehiclePreset[]>(VEHICLE_PRESETS);
  const [scenarios] = useState<ScenarioPreset[]>(SCENARIO_PRESETS);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(VEHICLE_PRESETS[0].id);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIO_PRESETS[0].id);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [timeStep, setTimeStep] = useState<number>(0);

  // Active Vehicle & Scenario
  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  const currentScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  // Telemetry & Health Data State
  const [telemetry, setTelemetry] = useState<BatteryTelemetry>(() =>
    generateLiveTelemetryFrame(currentVehicle, currentScenario, 0)
  );
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(() =>
    calculateHealthMetrics(telemetry, currentVehicle)
  );
  const [degradationCurve, setDegradationCurve] = useState<DegradationPoint[]>(() =>
    generateDegradationCurve(currentScenario.soh, currentScenario.initialCycle, currentVehicle.chemistry as 'NMC' | 'LFP')
  );

  // Sliding telemetry history buffer for charts
  const [telemetryHistory, setTelemetryHistory] = useState<BatteryTelemetry[]>([telemetry]);

  // XAI & Digital Doctor State
  const [aiAnalysis, setAiAnalysis] = useState<AIExplainResponse | null>(null);
  const [isXaiLoading, setIsXaiLoading] = useState<boolean>(false);

  const [isDoctorOpen, setIsDoctorOpen] = useState<boolean>(false);
  const [initialDoctorPrompt, setInitialDoctorPrompt] = useState<string>('');

  // Update telemetry when vehicle or scenario changes
  useEffect(() => {
    setTimeStep(0);
    const initialFrame = generateLiveTelemetryFrame(currentVehicle, currentScenario, 0);
    const initialHealth = calculateHealthMetrics(initialFrame, currentVehicle);
    const initialDeg = generateDegradationCurve(currentScenario.soh, currentScenario.initialCycle, currentVehicle.chemistry as 'NMC' | 'LFP');

    setTelemetry(initialFrame);
    setHealthMetrics(initialHealth);
    setDegradationCurve(initialDeg);
    setTelemetryHistory([initialFrame]);

    // Automatically trigger Gemini XAI explanation on scenario change
    fetchXaiExplanation(currentVehicle, currentScenario, initialFrame, initialHealth);
  }, [selectedVehicleId, selectedScenarioId]);

  // Live simulation tick interval
  useEffect(() => {
    if (!isSimulating) return;

    const intervalMs = 1500 / simSpeed;
    const timer = setInterval(() => {
      setTimeStep(prev => {
        const nextStep = prev + 1;
        const newFrame = generateLiveTelemetryFrame(currentVehicle, currentScenario, nextStep);
        const newHealth = calculateHealthMetrics(newFrame, currentVehicle);

        setTelemetry(newFrame);
        setHealthMetrics(newHealth);

        setTelemetryHistory(hist => {
          const updated = [...hist, newFrame];
          if (updated.length > 25) updated.shift();
          return updated;
        });

        return nextStep;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isSimulating, simSpeed, currentVehicle, currentScenario]);

  // Fetch XAI Explanation from Express backend (/api/explain-degradation)
  const fetchXaiExplanation = async (
    v = currentVehicle,
    s = currentScenario,
    t = telemetry,
    h = healthMetrics
  ) => {
    setIsXaiLoading(true);
    try {
      const response = await fetch('/api/explain-degradation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: v,
          scenario: s,
          telemetry: t,
          healthMetrics: h
        })
      });

      const data = await response.json();
      if (data.aiAnalysis) {
        setAiAnalysis(data.aiAnalysis);
      }
    } catch (err) {
      console.error('Failed to fetch XAI explanation:', err);
    } finally {
      setIsXaiLoading(false);
    }
  };

  // Open Chatbot Doctor with specific prompt
  const handleAskDoctorAboutAnomaly = (anomaly: BatteryAnomaly) => {
    setInitialDoctorPrompt(`Please explain this anomaly flag: "${anomaly.title}". Value was ${anomaly.value} (threshold: ${anomaly.threshold}). What is the root cause and immediate recommended action?`);
    setIsDoctorOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 pb-12">
      
      {/* Platform Navigation Header */}
      <Header
        vehicles={vehicles}
        scenarios={scenarios}
        selectedVehicleId={selectedVehicleId}
        selectedScenarioId={selectedScenarioId}
        isSimulating={isSimulating}
        simSpeed={simSpeed}
        onSelectVehicle={setSelectedVehicleId}
        onSelectScenario={setSelectedScenarioId}
        onToggleSimulation={() => setIsSimulating(!isSimulating)}
        onChangeSpeed={setSimSpeed}
        onResetSimulation={() => setTimeStep(0)}
        onOpenDoctor={() => {
          setInitialDoctorPrompt('');
          setIsDoctorOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        
        {/* Scenario Banner Overview */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-cyan-400 uppercase">Active Profile:</span>
              <span className="text-sm font-bold text-white">{currentScenario.title}</span>
            </div>
            <p className="text-xs text-slate-400 font-sans">{currentScenario.description}</p>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">PACK CHEMISTRY</span>
              <span className="text-white font-bold">{currentVehicle.chemistry} ({currentVehicle.totalEnergyKwh} kWh)</span>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px]">MAX DCFC POWER</span>
              <span className="text-cyan-400 font-bold">{currentVehicle.maxChargingKw} kW</span>
            </div>
          </div>
        </div>

        {/* 1. Core Battery Metric Cards */}
        <MetricCards
          telemetry={telemetry}
          healthMetrics={healthMetrics}
          vehicle={currentVehicle}
        />

        {/* 2. Real-Time Telemetry Stream & Capacity Degradation Curve */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TelemetryChart
            history={telemetryHistory}
            currentTelemetry={telemetry}
          />

          <DegradationChart
            degradationData={degradationCurve}
            currentCycle={telemetry.cycleCount}
            currentSoh={healthMetrics.soh}
          />
        </div>

        {/* 3. Explainable AI (XAI) Gemini Analysis */}
        <XaiAnalysisCard
          analysis={aiAnalysis}
          isLoading={isXaiLoading}
          onRefreshXai={() => fetchXaiExplanation()}
          onOpenDoctor={() => {
            setInitialDoctorPrompt('');
            setIsDoctorOpen(true);
          }}
        />

        {/* 4. BMS Comparison Module */}
        <BmsComparison
          telemetry={telemetry}
          healthMetrics={healthMetrics}
        />

        {/* 5. Alerts Feed & Smart Operational Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AlertFeed
            anomalies={healthMetrics.anomalies}
            onAskDoctorAboutAnomaly={handleAskDoctorAboutAnomaly}
          />

          <SmartRecommendations
            telemetry={telemetry}
            healthMetrics={healthMetrics}
            vehicle={currentVehicle}
            onOpenDoctor={() => {
              setInitialDoctorPrompt('');
              setIsDoctorOpen(true);
            }}
          />
        </div>

      </main>

      {/* Floating Digital Doctor AI Assistant Drawer */}
      <DigitalDoctorDrawer
        isOpen={isDoctorOpen}
        onClose={() => setIsDoctorOpen(false)}
        vehicle={currentVehicle}
        telemetry={telemetry}
        healthMetrics={healthMetrics}
        initialPrompt={initialDoctorPrompt}
      />

    </div>
  );
}
