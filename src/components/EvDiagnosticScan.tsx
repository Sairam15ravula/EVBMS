import React, { useState, useEffect } from "react";
import {
  Scan, Activity, ShieldCheck, AlertTriangle, Zap, Cpu,
  RefreshCw, CheckCircle2, ChevronRight, Eye, Radio, Thermometer,
  Gauge, Layers, Sliders, ArrowUpRight, Maximize2
} from "lucide-react";

const scanImage = "/ev_battery_scan.jpg";

interface EvDiagnosticScanProps {
  vehicleName: string;
  chemistry?: string;
  soh: number;
  soc?: number;
  temperature?: number;
  onOpenDoctor?: () => void;
}

interface DiagnosticSubsystem {
  id: string;
  name: string;
  x: number; // percentage on image
  y: number;
  status: "nominal" | "warning" | "optimal";
  metrics: { label: string; value: string }[];
  description: string;
}

export const EvDiagnosticScan: React.FC<EvDiagnosticScanProps> = ({
  vehicleName,
  chemistry = "NMC 811",
  soh,
  soc = 84,
  temperature = 24.5,
  onOpenDoctor,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(100);
  const [selectedSubsystem, setSelectedSubsystem] = useState<DiagnosticSubsystem | null>(null);
  const [laserPosition, setLaserPosition] = useState(45);

  const subsystems: DiagnosticSubsystem[] = [
    {
      id: "pack_core",
      name: "Skateboard Modular Battery Pack",
      x: 58,
      y: 60,
      status: "optimal",
      metrics: [
        { label: "Pack Voltage", value: "395.2 V" },
        { label: "Nominal Energy", value: "75.0 kWh" },
        { label: "Modules", value: "16 Series Banks" },
        { label: "State of Health", value: `${soh.toFixed(1)}%` },
      ],
      description: "Low-center-of-gravity structural battery enclosure housing high-energy-density cell modules with bottom ballistic shield.",
    },
    {
      id: "cell_balancer",
      name: "1RC EKF Cell State Estimator",
      x: 68,
      y: 52,
      status: "optimal",
      metrics: [
        { label: "Max Cell Spread", value: "14 mV (3.85V - 3.88V)" },
        { label: "EKF Residual", value: "0.0032 V" },
        { label: "Polarization V_rc", value: "-0.012 V" },
      ],
      description: "Real-time Extended Kalman Filter monitoring individual cell impedance and dynamic polarization voltages.",
    },
    {
      id: "thermal_manifold",
      name: "Liquid Cooling Ribbon Manifold",
      x: 48,
      y: 55,
      status: "optimal",
      metrics: [
        { label: "Coolant Flow Rate", value: "12.4 L/min" },
        { label: "Inlet Temp", value: "21.8 °C" },
        { label: "Outlet Temp", value: `${temperature.toFixed(1)} °C` },
        { label: "Thermal Gradient", value: "2.7 °C (Max)" },
      ],
      description: "Inter-cell micro-channel cooling ribbons maintaining pack temperature homogeneity within safe electrochemical bounds.",
    },
    {
      id: "front_drive",
      name: "Front Traction Inverter & Bus",
      x: 28,
      y: 62,
      status: "optimal",
      metrics: [
        { label: "Peak DC Current", value: "450 A" },
        { label: "Bus Isolation", value: "> 500 MΩ" },
        { label: "Switching Temp", value: "38.2 °C" },
      ],
      description: "Silicon Carbide (SiC) fast-switching traction inverter and high-voltage DC bus interconnection.",
    },
    {
      id: "pyrofuse",
      name: "HV Pyro-Switch & Safety Contactor",
      x: 75,
      y: 45,
      status: "optimal",
      metrics: [
        { label: "Pyro-Fuse Readiness", value: "ARMED" },
        { label: "Contact Resistance", value: "0.18 mΩ" },
        { label: "Response Latency", value: "< 2.0 ms" },
      ],
      description: "Millisecond-speed pyrotechnic disconnection unit triggered automatically upon severe thermal or collision anomalies.",
    },
  ];

  useEffect(() => {
    if (!selectedSubsystem) {
      setSelectedSubsystem(subsystems[0]);
    }
  }, []);

  const handleTriggerScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 2;
      setScanProgress(progress);
      setLaserPosition((progress * 0.9) % 100);
      if (progress >= 100) {
        clearInterval(interval);
        setIsScanning(false);
      }
    }, 40);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Banner Controls */}
      <div style={{
        background: "linear-gradient(135deg, #0D1917, #122320)",
        border: "1px solid #1D302C",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "rgba(34,217,122,0.13)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#22D97A"
          }}>
            <Scan size={22} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#E7ECEF" }}>
                Holographic Battery Diagnostic Scan
              </div>
              <span style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 6,
                background: "rgba(34,217,122,0.15)",
                color: "#22D97A",
                border: "1px solid rgba(34,217,122,0.3)"
              }}>
                LIVE TOMOGRAPHY
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#7E93A0", marginTop: 4 }}>
              Target Asset: <strong style={{ color: "#E7ECEF" }}>{vehicleName}</strong> · Chemistry: <span style={{ color: "#22D97A" }}>{chemistry}</span> · SoH: <span style={{ color: "#22D97A" }}>{soh.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleTriggerScan}
            disabled={isScanning}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "9px 16px",
              borderRadius: 10,
              background: "#22D97A",
              color: "#05080A",
              fontSize: 12,
              fontWeight: 700,
              border: "none",
              cursor: isScanning ? "default" : "pointer",
              opacity: isScanning ? 0.7 : 1,
              transition: "all 0.2s"
            }}
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
            {isScanning ? `Scanning Pack (${scanProgress}%)...` : "Trigger Full Pack Scan"}
          </button>

          {onOpenDoctor && (
            <button
              onClick={onOpenDoctor}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 10,
                background: "rgba(157,107,224,0.15)",
                border: "1px solid rgba(157,107,224,0.35)",
                color: "#9D6BE0",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              <Cpu size={14} />
              AI Doctor
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Scan Viewport & Telemetry Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        
        {/* Left Viewport */}
        <div style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          border: "1px solid #1D302C",
          background: "#05080A",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)"
        }}>
          {/* Base Image */}
          <img
            src={scanImage}
            alt="EV Holographic Battery Diagnostic Scan"
            style={{ width: "100%", height: "auto", display: "block", maxHeight: 500, objectFit: "cover" }}
          />

          {/* Animated Holographic Scanline Overlay */}
          {isScanning && (
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: `${laserPosition}%`,
                width: 3,
                background: "#22D97A",
                boxShadow: "0 0 20px #22D97A, 0 0 40px #22D97A",
                pointerEvents: "none",
                transition: "left 0.05s linear"
              }}
            />
          )}

          {/* Top Left HUD Overlay */}
          <div style={{
            position: "absolute",
            top: 14,
            left: 14,
            background: "rgba(5, 8, 10, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(34,217,122,0.3)",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 11,
            pointerEvents: "none"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22D97A", fontWeight: 700 }}>
              <Radio size={12} />
              <span>LASER TOMOGRAPHY ACTIVE</span>
            </div>
            <div style={{ color: "#E7ECEF", marginTop: 2 }}>
              SoC: <strong style={{ color: "#22D97A" }}>{soc}%</strong> | Voltage: <strong>395.2V</strong>
            </div>
          </div>

          {/* Top Right HUD Overlay */}
          <div style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(5, 8, 10, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid #1D302C",
            borderRadius: 10,
            padding: "8px 12px",
            fontSize: 11,
            textAlign: "right",
            pointerEvents: "none"
          }}>
            <div style={{ color: "#7E93A0" }}>THERMAL GRADIENT</div>
            <div style={{ color: "#22D97A", fontWeight: 700, fontSize: 13 }}>{temperature.toFixed(1)}°C <span style={{ fontSize: 10, color: "#7E93A0" }}>(Peak 26.0°C)</span></div>
          </div>

          {/* Interactive Subsystem Hotspots */}
          {subsystems.map((sub) => {
            const isSelected = selectedSubsystem?.id === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setSelectedSubsystem(sub)}
                style={{
                  position: "absolute",
                  top: `${sub.y}%`,
                  left: `${sub.x}%`,
                  transform: "translate(-50%, -50%)",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                  zIndex: isSelected ? 30 : 20
                }}
                title={sub.name}
              >
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: isSelected ? "2px solid #FFFFFF" : "2px solid #22D97A",
                      background: isSelected ? "#22D97A" : "rgba(5, 8, 10, 0.9)",
                      color: isSelected ? "#05080A" : "#22D97A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: isSelected ? "0 0 16px #22D97A" : "0 0 8px rgba(34,217,122,0.5)",
                      transform: isSelected ? "scale(1.2)" : "scale(1)",
                      transition: "all 0.2s"
                    }}
                  >
                    <Zap size={12} />
                  </div>
                </div>
              </button>
            );
          })}

          {/* Bottom Floating Legend */}
          <div style={{
            position: "absolute",
            bottom: 12,
            left: 14,
            right: 14,
            background: "rgba(5, 8, 10, 0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid #1D302C",
            borderRadius: 10,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 11.5,
            color: "#7E93A0"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Layers size={13} color="#22D97A" />
              <span>Click any hotspot node to inspect live subsystem telemetry</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#22D97A" }}>
              <ShieldCheck size={13} />
              <span>All 16 Pack Modules Nominal</span>
            </div>
          </div>
        </div>

        {/* Right Details Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {selectedSubsystem && (
            <div style={{
              background: "#0D1917",
              border: "1px solid #1D302C",
              borderRadius: 16,
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", borderBottom: "1px solid #1D302C", paddingBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, color: "#22D97A", textTransform: "uppercase", fontWeight: 700 }}>
                    Subsystem Diagnostics
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#E7ECEF", marginTop: 2 }}>
                    {selectedSubsystem.name}
                  </div>
                </div>
                <span style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: "rgba(34,217,122,0.15)",
                  color: "#22D97A",
                  border: "1px solid rgba(34,217,122,0.3)"
                }}>
                  {selectedSubsystem.status.toUpperCase()}
                </span>
              </div>

              <div style={{ fontSize: 12.5, color: "#7E93A0", lineHeight: 1.5 }}>
                {selectedSubsystem.description}
              </div>

              {/* Subsystem Metrics */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "#7E93A0", textTransform: "uppercase", fontWeight: 600 }}>
                  Live Sensor Readings
                </div>
                {selectedSubsystem.metrics.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: "#122320",
                      border: "1px solid #1D302C",
                      borderRadius: 10,
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: 12
                    }}
                  >
                    <span style={{ color: "#7E93A0" }}>{m.label}</span>
                    <strong style={{ color: "#22D97A" }}>{m.value}</strong>
                  </div>
                ))}
              </div>

              {/* Safety Checks */}
              <div style={{
                background: "#05080A",
                border: "1px solid #1D302C",
                borderRadius: 12,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4
              }}>
                <div style={{ fontSize: 10.5, color: "#7E93A0", textTransform: "uppercase", fontWeight: 600 }}>
                  Automated Safety Checks
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#E7ECEF" }}>
                  <CheckCircle2 size={13} color="#22D97A" />
                  <span>Thermal Gradient &lt; 3.0°C</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#E7ECEF" }}>
                  <CheckCircle2 size={13} color="#22D97A" />
                  <span>Insulation Resistance &gt; 500 MΩ</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#E7ECEF" }}>
                  <CheckCircle2 size={13} color="#22D97A" />
                  <span>Pouch Swelling Strain &lt; 0.4%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
