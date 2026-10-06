import React, { useState, useEffect, useRef } from 'react';
import EvBmsPlatform from './EvBmsPlatform';
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
import { LoginModal } from './components/LoginModal';
import { AuthProvider } from './context/AuthContext';
import { VEHICLE_PRESETS, SCENARIO_PRESETS, generateLiveTelemetryFrame, generateDegradationCurve } from './data/batteryData';
import { calculateHealthMetrics } from './utils/analyticsEngine';
import { telemetrySocket } from './services/telemetrySocket';
import { EvOwnerDashboard } from './components/views/EvOwnerDashboard';
import { FleetOperatorDashboard } from './components/views/FleetOperatorDashboard';
import { ServiceCenterDashboard } from './components/views/ServiceCenterDashboard';
import { useAuth } from './context/AuthContext';

export type DashboardViewMode = 'owner' | 'fleet' | 'service' | 'lab' | 'platform';

function MainApp() {
  const { user, isAuthenticated } = useAuth();
  const [viewMode, setViewMode] = useState<DashboardViewMode>('owner');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Automatically route to tailored dashboard based on logged-in user role
  useEffect(() => {
    if (user?.role === 'driver') {
      setViewMode('owner');
    } else if (user?.role === 'fleet_manager') {
      setViewMode('fleet');
    } else if (user?.role === 'technician') {
      setViewMode('service');
    }
  }, [user?.role]);

  // Simulation State for Lab View
  const [vehicles] = useState<EVVehiclePreset[]>(VEHICLE_PRESETS);
  const [scenarios] = useState<ScenarioPreset[]>(SCENARIO_PRESETS);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(VEHICLE_PRESETS[0].id);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(SCENARIO_PRESETS[0].id);
  const [isSimulating, setIsSimulating] = useState<boolean>(true);
  const [simSpeed, setSimSpeed] = useState<number>(1);
  const [timeStep, setTimeStep] = useState<number>(0);

  const currentVehicle = vehicles.find(v => v.id === selectedVehicleId) || vehicles[0];
  const currentScenario = scenarios.find(s => s.id === selectedScenarioId) || scenarios[0];

  const [telemetry, setTelemetry] = useState<BatteryTelemetry>(() =>
    generateLiveTelemetryFrame(currentVehicle, currentScenario, 0)
  );
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics>(() =>
    calculateHealthMetrics(telemetry, currentVehicle)
  );
  const [degradationCurve, setDegradationCurve] = useState<DegradationPoint[]>(() =>
    generateDegradationCurve(currentScenario.soh, currentScenario.initialCycle, currentVehicle.chemistry as 'NMC' | 'LFP')
  );
  const [telemetryHistory, setTelemetryHistory] = useState<BatteryTelemetry[]>([telemetry]);
  const [aiAnalysis, setAiAnalysis] = useState<AIExplainResponse | null>(null);
  const [isXaiLoading, setIsXaiLoading] = useState<boolean>(false);
  const [isDoctorOpen, setIsDoctorOpen] = useState<boolean>(false);
  const [initialDoctorPrompt, setInitialDoctorPrompt] = useState<string>('');

  // Fetch XAI analysis from Express server
  const fetchXaiAnalysis = React.useCallback(async () => {
    setIsXaiLoading(true);
    try {
      const res = await fetch('/api/explain-degradation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicle: currentVehicle,
          scenario: currentScenario,
          telemetry,
          healthMetrics
        })
      });
      const data = await res.json();
      if (data.success && data.aiAnalysis) {
        setAiAnalysis({
          ...data.aiAnalysis,
          soh_shap: data.aiAnalysis.soh_shap || data.soh_shap,
          rul_shap: data.aiAnalysis.rul_shap || data.rul_shap,
          anomaly_shap: data.aiAnalysis.anomaly_shap || data.anomaly_shap,
        });
      }
    } catch (err) {
      console.error('Failed to fetch XAI analysis:', err);
    } finally {
      setIsXaiLoading(false);
    }
  }, [currentVehicle, currentScenario, telemetry, healthMetrics]);

  // Reactive WebSocket Connection State
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  // Reset telemetry on vehicle / scenario / viewMode change
  React.useEffect(() => {
    if (viewMode !== 'lab') return;
    setTimeStep(0);
    const initialFrame = generateLiveTelemetryFrame(currentVehicle, currentScenario, 0);
    const initialHealth = calculateHealthMetrics(initialFrame, currentVehicle);
    const initialDeg = generateDegradationCurve(currentScenario.soh, currentScenario.initialCycle, currentVehicle.chemistry as 'NMC' | 'LFP');

    setTelemetry(initialFrame);
    setHealthMetrics(initialHealth);
    setDegradationCurve(initialDeg);
    setTelemetryHistory([initialFrame]);

    fetchXaiAnalysis();
  }, [selectedVehicleId, selectedScenarioId, viewMode]);

  // WebSocket telemetry connection & reactive status listener for Lab view
  React.useEffect(() => {
    if (viewMode !== 'lab') return;

    telemetrySocket.connect();

    const unsubscribeStatus = telemetrySocket.onStatusChange((connected) => {
      setIsWsConnected(connected);
      if (connected) {
        telemetrySocket.selectVehicle(selectedVehicleId);
        telemetrySocket.selectScenario(selectedScenarioId);
      }
    });

    const unsubscribeTelemetry = telemetrySocket.subscribe((frame: BatteryTelemetry) => {
      setTelemetry(frame);
      setHealthMetrics(calculateHealthMetrics(frame, currentVehicle));
      setTelemetryHistory((prevHistory) => {
        const updated = [...prevHistory, frame];
        return updated.length > 30 ? updated.slice(updated.length - 30) : updated;
      });
    });

    return () => {
      unsubscribeStatus();
      unsubscribeTelemetry();
    };
  }, [viewMode, currentVehicle]);

  // Sync vehicle and scenario selection changes over WebSocket
  React.useEffect(() => {
    if (viewMode === 'lab' && isWsConnected) {
      telemetrySocket.selectVehicle(selectedVehicleId);
      telemetrySocket.selectScenario(selectedScenarioId);
    }
  }, [selectedVehicleId, selectedScenarioId, viewMode, isWsConnected]);

  // Fallback simulation loop when WebSocket is not connected
  React.useEffect(() => {
    if (viewMode !== 'lab' || !isSimulating) return;
    if (isWsConnected) return;

    const intervalMs = Math.max(200, 1500 / simSpeed);
    const timer = setInterval(() => {
      setTimeStep((prevStep) => {
        const nextStep = prevStep + 1;
        const nextFrame = generateLiveTelemetryFrame(currentVehicle, currentScenario, nextStep);
        const nextHealth = calculateHealthMetrics(nextFrame, currentVehicle);

        setTelemetry(nextFrame);
        setHealthMetrics(nextHealth);
        setTelemetryHistory((prevHistory) => {
          const updated = [...prevHistory, nextFrame];
          return updated.length > 30 ? updated.slice(updated.length - 30) : updated;
        });

        return nextStep;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [viewMode, isSimulating, simSpeed, isWsConnected, currentVehicle, currentScenario]);


  const handleResetSimulation = () => {
    setTimeStep(0);
    const initialFrame = generateLiveTelemetryFrame(currentVehicle, currentScenario, 0);
    const initialHealth = calculateHealthMetrics(initialFrame, currentVehicle);
    setTelemetry(initialFrame);
    setHealthMetrics(initialHealth);
    setTelemetryHistory([initialFrame]);
  };

  const handleOpenDoctorWithPrompt = (prompt?: string) => {
    setInitialDoctorPrompt(prompt || '');
    setIsDoctorOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 font-sans antialiased selection:bg-cyan-500 selection:text-slate-950 pb-12">
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
        onResetSimulation={handleResetSimulation}
        onOpenDoctor={() => handleOpenDoctorWithPrompt()}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* Role-Based Dashboard View Switcher Toolbar */}
      <div className="bg-slate-950/90 border-b border-slate-800 px-4 lg:px-8 py-2 sticky top-[68px] z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-slate-400 mr-2 flex items-center gap-1">
              <span>Persona View:</span>
            </span>
            <button
              onClick={() => setViewMode('owner')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                viewMode === 'owner'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🚗 <span>EV Owner</span>
            </button>
            <button
              onClick={() => setViewMode('fleet')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                viewMode === 'fleet'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              📊 <span>Fleet Operator</span>
            </button>
            <button
              onClick={() => setViewMode('service')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                viewMode === 'service'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🔧 <span>Service Center</span>
            </button>
            <button
              onClick={() => setViewMode('lab')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                viewMode === 'lab'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              ⚡ <span>Telemetry Lab</span>
            </button>
            <button
              onClick={() => setViewMode('platform')}
              className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                viewMode === 'platform'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              🏢 <span>Full Platform</span>
            </button>
          </div>

          {isAuthenticated && user && (
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>Signed in as: <strong className="text-emerald-400">{user.email}</strong></span>
              <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 uppercase font-bold text-slate-300">
                {user.role}
              </span>
            </div>
          )}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 lg:px-8 pt-6 space-y-6">
        {viewMode === 'owner' && (
          <EvOwnerDashboard
            vehicle={currentVehicle}
            telemetry={telemetry}
            healthMetrics={healthMetrics}
            onOpenDoctor={handleOpenDoctorWithPrompt}
          />
        )}

        {viewMode === 'fleet' && (
          <FleetOperatorDashboard
            onSelectVehicle={(vehId) => {
              const matched = vehicles.find((v) => v.id === vehId);
              if (matched) {
                setSelectedVehicleId(vehId);
              }
              setViewMode('owner');
            }}
            onOpenDoctor={handleOpenDoctorWithPrompt}
          />
        )}

        {viewMode === 'service' && (
          <ServiceCenterDashboard
            vehicle={currentVehicle}
            telemetry={telemetry}
            healthMetrics={healthMetrics}
            onOpenDoctor={handleOpenDoctorWithPrompt}
          />
        )}

        {viewMode === 'platform' && (
          <div className="rounded-2xl overflow-hidden border border-slate-800">
            <EvBmsPlatform />
          </div>
        )}

        {viewMode === 'lab' && (
          <>
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

            <MetricCards
              telemetry={telemetry}
              healthMetrics={healthMetrics}
              vehicle={currentVehicle}
            />

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

            <XaiAnalysisCard
              analysis={aiAnalysis}
              isLoading={isXaiLoading}
              onRefreshXai={fetchXaiAnalysis}
              onOpenDoctor={() => setIsDoctorOpen(true)}
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AlertFeed
                  anomalies={healthMetrics.anomalies}
                  onAskDoctorAboutAnomaly={handleAskDoctorAboutAnomaly}
                />
              </div>
              <div>
                <SmartRecommendations
                  telemetry={telemetry}
                  healthMetrics={healthMetrics}
                  vehicle={currentVehicle}
                  onOpenDoctor={() => setIsDoctorOpen(true)}
                />
              </div>
            </div>

            <BmsComparison
              telemetry={telemetry}
              healthMetrics={healthMetrics}
            />
          </>
        )}
      </main>

      <DigitalDoctorDrawer
        isOpen={isDoctorOpen}
        onClose={() => setIsDoctorOpen(false)}
        context={{
          vehicle: currentVehicle,
          telemetry,
          healthMetrics
        }}
        initialPrompt={initialDoctorPrompt}
      />

      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </div>
  );

  function handleAskDoctorAboutAnomaly(anomaly: BatteryAnomaly) {
    setInitialDoctorPrompt(`Please explain this anomaly flag: "${anomaly.title}". Value was ${anomaly.value} (threshold: ${anomaly.threshold}). What is the root cause and immediate recommended action?`);
    setIsDoctorOpen(true);
  }
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
