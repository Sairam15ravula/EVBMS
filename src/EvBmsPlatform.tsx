import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Legend
} from "recharts";
import {
  Activity, AlertTriangle, Battery, BatteryCharging, Bell, Bot,
  ChevronRight, Clock, Gauge, Info, Send,
  Settings, ShieldAlert, ShieldCheck, Sparkles, TrendingDown,
  TrendingUp, Wifi, X, Zap, Car, Plug, Layers, Scan
} from "lucide-react";
import { CellGridMonitor } from "./components/CellGridMonitor";
import { EvDiagnosticScan } from "./components/EvDiagnosticScan";

/* ============================================================
   DESIGN TOKENS — dark automotive system per design doc
   ============================================================ */
const COLORS = {
  bg: "#05080A",
  surface: "#0D1917",
  surfaceAlt: "#122320",
  border: "#1D302C",
  borderSoft: "#162622",
  green: "#22D97A",
  greenSoft: "rgba(34,217,122,0.13)",
  amber: "#F5A524",
  amberSoft: "rgba(245,165,36,0.13)",
  red: "#F5484B",
  redSoft: "rgba(245,72,75,0.13)",
  purple: "#9D6BE0",
  purpleSoft: "rgba(157,107,224,0.14)",
  textPrimary: "#E7ECEF",
  textSecondary: "#7E93A0",
  textMuted: "#4C5D64",
};

const EOL_THRESHOLD = 80;

export type RiskLevel = 'healthy' | 'watch' | 'at-risk' | 'critical';

const RISK_META: Record<RiskLevel, { label: string; color: string; soft: string; Icon: any }> = {
  healthy: { label: "Healthy", color: COLORS.green, soft: COLORS.greenSoft, Icon: ShieldCheck },
  watch: { label: "Watch", color: "#7FD8A8", soft: "rgba(127,216,168,0.12)", Icon: Info },
  "at-risk": { label: "At Risk", color: COLORS.amber, soft: COLORS.amberSoft, Icon: AlertTriangle },
  critical: { label: "Critical", color: COLORS.red, soft: COLORS.redSoft, Icon: ShieldAlert },
};

/* ============================================================
   SEEDED PRNG — reproducible demo data
   ============================================================ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TelemetryPoint {
  cycle: number;
  soh: number;
  capacity: number;
  temp: number;
  resistance: number;
  voltage: number;
  current: number;
  hour: number;
  dayofweek: number;
  fastCharge: boolean;
}

export interface AnomalyItem {
  cycle: number;
  feature: string;
  score: number;
  severity: 'high' | 'medium' | 'low';
}

export interface ContributingFactor {
  label: string;
  pct: number;
}

export interface ChargingSession {
  id: string;
  daysAgo: number;
  mode: string;
  powerKw: number;
  startSoC: number;
  endSoC: number;
  avgTemp: number;
  durationMin: number;
  cls: {
    label: string;
    tone: 'green' | 'amber' | 'red' | 'blue';
    tip: string;
    efficiency: number;
  };
}

export interface RulResult {
  status: 'normal' | 'past-threshold' | 'flat' | 'unavailable';
  cyclesRemaining: number;
  yearsLow: number;
  yearsHigh: number;
  lastSoh: number;
  slope: number;
  intercept: number;
  lastCycle: number;
  cycleAtEOL?: number;
}

export interface ForecastPoint {
  cycle: number;
  historical: number | null;
  forecast: number | null;
}

export interface BatteryVehicle {
  id: string;
  name: string;
  model: string;
  seed: number;
  cycles: number;
  kneeFrac: number;
  endSoH: number;
  tempBase: number;
  tempNoise: number;
  fastChargeFreq: number;
  cyclesPerYear: number;
  spikes: Array<{ cycle: number; width?: number; tempBoost?: number; resistanceBoost?: number }>;
  history: TelemetryPoint[];
  rul: RulResult;
  anomalies: AnomalyItem[];
  factors: ContributingFactor[];
  sessions: ChargingSession[];
  forecast: ForecastPoint[];
  soh: number;
  risk: RiskLevel;
  last: TelemetryPoint;
  ratedCapacity: number;
}

/* ============================================================
   SYNTHETIC BATTERY DATA ENGINE
   ============================================================ */
function genHistory(cfg: {
  seed: number; cycles: number; kneeFrac: number; endSoH: number;
  tempBase: number; tempNoise: number; fastChargeFreq: number;
  spikes: Array<{ cycle: number; width?: number; tempBoost?: number; resistanceBoost?: number }>;
}): TelemetryPoint[] {
  const rand = mulberry32(cfg.seed);
  const rated = 75;
  const kneeCycle = cfg.cycles * cfg.kneeFrac;
  const shapeAt = (x: number) =>
    x <= kneeCycle ? x / kneeCycle : 1 + ((x - kneeCycle) / Math.max(1, cfg.cycles - kneeCycle)) ** 1.6 * 1.86;
  const fadeAtEnd = shapeAt(cfg.cycles);
  const points: TelemetryPoint[] = [];

  for (let c = 1; c <= cfg.cycles; c++) {
    const totalFade = 1 - cfg.endSoH / 100;
    const fadeFrac = totalFade * (shapeAt(c) / fadeAtEnd);
    const noise = (rand() - 0.5) * 0.004;
    const capacity = rated * (1 - fadeFrac + noise);
    const soh = (capacity / rated) * 100;
    let temp = cfg.tempBase + Math.sin(c / 9) * 2 + (rand() - 0.5) * cfg.tempNoise;
    let resistance = 32 + fadeFrac * 140 + (rand() - 0.5) * 3;
    for (const sp of cfg.spikes) {
      const d = c - sp.cycle;
      const width = sp.width || 2;
      const bump = Math.exp(-(d * d) / (2 * width * width));
      temp += (sp.tempBoost || 0) * bump;
      resistance += (sp.resistanceBoost || 0) * bump;
    }
    const voltage = 3.9 - fadeFrac * 0.35 + (rand() - 0.5) * 0.02;
    const current = -180 + (rand() - 0.5) * 10;
    points.push({
      cycle: c,
      soh: +soh.toFixed(2),
      capacity: +capacity.toFixed(2),
      temp: +temp.toFixed(1),
      resistance: +resistance.toFixed(1),
      voltage: +voltage.toFixed(3),
      current: +current.toFixed(1),
      hour: Math.floor(rand() * 24),
      dayofweek: Math.floor(rand() * 7),
      fastCharge: rand() < cfg.fastChargeFreq,
    });
  }
  return points;
}

function computeRUL(history: TelemetryPoint[], cyclesPerYear: number, eolThreshold = EOL_THRESHOLD): RulResult {
  const recent = history.slice(-Math.min(50, history.length));
  const n = recent.length;
  const xs = recent.map((p) => p.cycle);
  const ys = recent.map((p) => p.soh);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  const slope = num / den;
  const intercept = yMean - slope * xMean;
  const lastCycle = history[history.length - 1].cycle;
  const lastSoh = history[history.length - 1].soh;

  if (lastSoh <= eolThreshold) {
    return { status: "past-threshold", cyclesRemaining: 0, yearsLow: 0, yearsHigh: 0.4, lastSoh, slope, intercept, lastCycle };
  }
  if (slope >= -0.001) {
    return { status: "flat", cyclesRemaining: 999, yearsLow: 5, yearsHigh: 8, lastSoh, slope, intercept, lastCycle };
  }
  const cycleAtEOL = (eolThreshold - intercept) / slope;
  const cyclesRemaining = Math.max(1, Math.round(cycleAtEOL - lastCycle));
  const yearsMid = cyclesRemaining / cyclesPerYear;
  return {
    status: "normal",
    cyclesRemaining,
    yearsLow: +(yearsMid * 0.8).toFixed(1),
    yearsHigh: +(yearsMid * 1.25).toFixed(1),
    lastSoh, slope, intercept, lastCycle, cycleAtEOL,
  };
}

function buildCapacityForecast(history: TelemetryPoint[], rul: RulResult): ForecastPoint[] {
  const hist: ForecastPoint[] = history.map((p) => ({ cycle: p.cycle, historical: p.soh, forecast: null }));
  if (rul.status !== "normal" || !rul.cycleAtEOL) return hist;
  const steps = 10;
  const forecastPts: ForecastPoint[] = [];
  const startCycle = rul.lastCycle;
  const endCycle = Math.max(startCycle + 1, Math.round(rul.cycleAtEOL));
  for (let i = 0; i <= steps; i++) {
    const cycle = Math.round(startCycle + ((endCycle - startCycle) * i) / steps);
    const soh = rul.intercept + rul.slope * cycle;
    forecastPts.push({ cycle, historical: null, forecast: +Math.max(soh, EOL_THRESHOLD - 2).toFixed(2) });
  }
  if (forecastPts.length > 0 && hist.length > 0) {
    forecastPts[0].forecast = hist[hist.length - 1].historical;
  }
  return [...hist, ...forecastPts];
}

function detectAnomalies(history: TelemetryPoint[], threshold = 3.3): AnomalyItem[] {
  const win = 15;
  const n = history.length;
  const zSeries = (key: 'temp' | 'resistance') => {
    const z = new Array(n).fill(0);
    for (let i = win; i < n; i++) {
      const w = history.slice(i - win, i);
      const mean = w.reduce((a, p) => a + p[key], 0) / win;
      const sd = Math.sqrt(w.reduce((a, p) => a + (p[key] - mean) ** 2, 0) / win) || 0.5;
      z[i] = (history[i][key] - mean) / sd;
    }
    return z;
  };
  const zTemp = zSeries("temp");
  const zRes = zSeries("resistance");
  const raw: Array<{ cycle: number; idx: number; feature: string; score: number }> = [];

  for (let i = win; i < n; i++) {
    const capDrop = history[i - 1].soh - history[i].soh;
    const candidates = [
      { feature: "temperature", z: zTemp[i] },
      { feature: "internal resistance", z: zRes[i] },
      { feature: "capacity drop", z: capDrop / 0.25 },
    ].sort((a, b) => b.z - a.z);
    const top = candidates[0];
    if (top.z > threshold) raw.push({ cycle: history[i].cycle, idx: i, feature: top.feature, score: +top.z.toFixed(2) });
  }

  const peaks = raw.filter((e) => {
    const nb = raw.filter((o) => Math.abs(o.idx - e.idx) <= 2 && o.idx !== e.idx);
    return nb.every((o) => o.score <= e.score);
  });

  const clustered: Array<{ cycle: number; idx: number; feature: string; score: number }> = [];
  for (const e of peaks.sort((a, b) => a.cycle - b.cycle)) {
    const last = clustered[clustered.length - 1];
    if (last && e.cycle - last.cycle <= 4) {
      if (e.score > last.score) clustered[clustered.length - 1] = e;
    } else clustered.push(e);
  }

  return clustered
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((e) => ({
      cycle: e.cycle,
      feature: e.feature,
      score: e.score,
      severity: (e.score > 5 ? "high" : e.score > 4 ? "medium" : "low") as 'high' | 'medium' | 'low',
    }))
    .sort((a, b) => b.cycle - a.cycle);
}

function computeContributingFactors({ fastChargeFreq, avgTemp, cycles, maxCycles }: {
  fastChargeFreq: number; avgTemp: number; cycles: number; maxCycles: number;
}): ContributingFactor[] {
  const tempScore = Math.max(0.05, (avgTemp - 24) / 18);
  const fastScore = Math.max(0.05, fastChargeFreq);
  const cycleScore = Math.max(0.05, cycles / maxCycles);
  const calendarScore = 0.3 + cycleScore * 0.35;
  const raw: Record<string, number> = {
    "Frequent fast charging": fastScore,
    "High operating temperature": tempScore,
    "Cycle wear (usage volume)": cycleScore,
    "Calendar aging": calendarScore,
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  const pct: Record<string, number> = {};
  Object.keys(raw).forEach((k) => (pct[k] = Math.round((raw[k] / total) * 100)));
  const keys = Object.keys(pct);
  const diff = 100 - keys.reduce((a, k) => a + pct[k], 0);
  pct[keys[0]] += diff;
  return keys.map((k) => ({ label: k, pct: pct[k] })).sort((a, b) => b.pct - a.pct);
}

function generateChargingSessions({ seed, count, tempBase, fastChargeFreq }: {
  seed: number; count: number; tempBase: number; fastChargeFreq: number;
}): ChargingSession[] {
  const rand = mulberry32(seed);
  const sessions: ChargingSession[] = [];
  for (let i = 0; i < count; i++) {
    const isDC = rand() < fastChargeFreq * 1.3;
    const startSoC = Math.round(10 + rand() * 40);
    const endSoC = Math.round(isDC ? 60 + rand() * 25 : 75 + rand() * 25);
    const powerKw = isDC ? 50 + rand() * 100 : 6 + rand() * 5;
    const avgTemp = tempBase + (rand() - 0.5) * 8 + (isDC ? 4 : 0);
    const durationMin = Math.round(((endSoC - startSoC) / 100) * 75 * (isDC ? 60 / powerKw : 60 / powerKw));
    
    const sessBase = {
      id: `s${i}`,
      daysAgo: Math.round(i * (2 + rand() * 2)),
      mode: isDC ? "DC Fast" : "AC",
      powerKw: +powerKw.toFixed(1),
      startSoC, endSoC,
      avgTemp: +avgTemp.toFixed(1),
      durationMin: Math.max(8, durationMin),
    };
    const cls = classifyCharging(sessBase);
    sessions.push({ ...sessBase, cls });
  }
  return sessions.sort((a, b) => a.daysAgo - b.daysAgo);
}

function classifyCharging(s: { mode: string; powerKw: number; avgTemp: number; startSoC: number; endSoC: number }): ChargingSession['cls'] {
  const baseEff = 0.95;
  let efficiency = baseEff - (s.powerKw > 60 ? 0.05 : 0) - (s.avgTemp < 10 ? 0.03 : 0) - (s.avgTemp > 40 ? 0.02 : 0);
  efficiency = Math.max(0.8, Math.min(0.97, efficiency));
  if (s.mode === "DC Fast" && s.powerKw > 100 && s.avgTemp > 35) {
    return { label: "Aggressive fast charge — high stress", tone: "red", tip: "Frequent high-power charging in warm conditions accelerates wear. Prefer AC charging when time allows.", efficiency };
  }
  if (s.endSoC >= 97) {
    return { label: "Full charge — accelerates wear", tone: "amber", tip: "Charging past ~90% regularly adds stress at the top of the voltage window. Consider 20–80% for daily use.", efficiency };
  }
  if (s.mode === "DC Fast" && s.powerKw > 60) {
    return { label: "Fast charge — moderate stress", tone: "amber", tip: "Fine occasionally; relying on it daily will shorten lifespan versus AC charging.", efficiency };
  }
  if (s.avgTemp < 8) {
    return { label: "Cold-weather charge — reduced efficiency", tone: "blue", tip: "Charging in cold conditions is lower-efficiency and briefly raises internal resistance. Preconditioning helps.", efficiency };
  }
  if (s.startSoC >= 15 && s.endSoC <= 82) {
    return { label: "Optimal — battery-friendly", tone: "green", tip: "This is close to the ideal charging window for long-term battery health.", efficiency };
  }
  return { label: "Standard charge — normal", tone: "green", tip: "Within normal operating parameters.", efficiency };
}

const FLEET_CONFIG = [
  { id: "v1", name: "Fleet Van 07", model: "Cargo EV 400", seed: 11, cycles: 130, kneeFrac: 1.5, endSoH: 95.3, tempBase: 24, tempNoise: 2.5, fastChargeFreq: 0.1, cyclesPerYear: 85, spikes: [] },
  { id: "v2", name: "Sedan 214", model: "Urban EV Sedan", seed: 22, cycles: 175, kneeFrac: 1.15, endSoH: 86.4, tempBase: 29, tempNoise: 3.5, fastChargeFreq: 0.28, cyclesPerYear: 95, spikes: [] },
  { id: "v3", name: "Rideshare 09", model: "Urban EV Sedan", seed: 33, cycles: 150, kneeFrac: 0.62, endSoH: 78.9, tempBase: 34, tempNoise: 5, fastChargeFreq: 0.58, cyclesPerYear: 120, spikes: [{ cycle: 128, width: 2, tempBoost: 14, resistanceBoost: 10 }] },
  { id: "v4", name: "Delivery 21", model: "Cargo EV 400", seed: 44, cycles: 225, kneeFrac: 0.5, endSoH: 67.8, tempBase: 35, tempNoise: 6, fastChargeFreq: 0.62, cyclesPerYear: 120, spikes: [] },
  { id: "v5", name: "Sedan 118", model: "Urban EV Sedan", seed: 55, cycles: 115, kneeFrac: 1.4, endSoH: 90.5, tempBase: 26, tempNoise: 3, fastChargeFreq: 0.2, cyclesPerYear: 90, spikes: [{ cycle: 95, width: 1.5, tempBoost: 16, resistanceBoost: 6 }] },
];

function computeRisk(soh: number, anomalies: AnomalyItem[]): RiskLevel {
  let score = 0;
  if (soh <= 72) score += 3;
  else if (soh <= EOL_THRESHOLD) score += 2;
  else if (soh <= 90) score += 1;
  const maxSev = anomalies.reduce((m, a) => Math.max(m, a.severity === "high" ? 2 : a.severity === "medium" ? 1 : 0.3), 0);
  score += maxSev;
  if (score >= 3.5) return "critical";
  if (score >= 2) return "at-risk";
  if (score >= 0.8) return "watch";
  return "healthy";
}

function buildFleet(): BatteryVehicle[] {
  return FLEET_CONFIG.map((cfg) => {
    const history = genHistory(cfg);
    const rul = computeRUL(history, cfg.cyclesPerYear);
    const anomalies = detectAnomalies(history);
    const factors = computeContributingFactors({ fastChargeFreq: cfg.fastChargeFreq, avgTemp: cfg.tempBase, cycles: cfg.cycles, maxCycles: 250 });
    const sessions = generateChargingSessions({ seed: cfg.seed + 500, count: 10, tempBase: cfg.tempBase, fastChargeFreq: cfg.fastChargeFreq });
    const forecast = buildCapacityForecast(history, rul);
    const soh = history[history.length - 1].soh;
    const risk = computeRisk(soh, anomalies);
    const last = history[history.length - 1];
    return { ...cfg, history, rul, anomalies, factors, sessions, forecast, soh, risk, last, ratedCapacity: 75 };
  });
}

/* ============================================================
   UI COMPONENTS
   ============================================================ */
function RiskBadge({ risk, size = "md" }: { risk: RiskLevel; size?: "sm" | "md" }) {
  const meta = RISK_META[risk];
  const Icon = meta.Icon;
  const pad = size === "sm" ? "2px 8px" : "4px 12px";
  const font = size === "sm" ? 11 : 12.5;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: pad, borderRadius: 999, background: meta.soft, color: meta.color, fontSize: font, fontWeight: 600, letterSpacing: 0.3 }}>
      <Icon size={size === "sm" ? 12 : 14} />
      {meta.label.toUpperCase()}
    </span>
  );
}

function SectionCard({ title, icon: Icon, right, children, style }: { title?: string; icon?: any; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: 18, ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.textSecondary, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase" }}>
            {Icon && <Icon size={14} />}
            {title}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function MetricCard({ label, value, unit, trend, sub, accent }: { label: string; value: string | number; unit?: string; trend?: 'up' | 'down'; sub?: string; accent?: string }) {
  return (
    <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 14, padding: "16px 18px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 24, fontWeight: 700, color: accent || COLORS.textPrimary, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: COLORS.textSecondary }}>{unit}</span>}
      </div>
      {(sub || trend) && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: COLORS.textSecondary }}>
          {trend === "up" && <TrendingUp size={12} color={COLORS.green} />}
          {trend === "down" && <TrendingDown size={12} color={COLORS.red} />}
          {sub}
        </div>
      )}
    </div>
  );
}

function UnitTooltip({ active, payload, label, unit }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: "#0A1513", border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
      <div style={{ color: COLORS.textSecondary, marginBottom: 4 }}>Cycle {label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, fontVariantNumeric: "tabular-nums" }}>
          {p.name}: {typeof p.value === "number" ? p.value.toFixed(2) : p.value} {unit || ""}
        </div>
      ))}
    </div>
  );
}

function BatteryGlyph({ soh, risk }: { soh: number; risk: RiskLevel }) {
  const meta = RISK_META[risk];
  const fillPct = Math.max(4, Math.min(100, soh));
  return (
    <div style={{ position: "relative", width: 96, flexShrink: 0 }}>
      <svg viewBox="0 0 60 100" width="80" height="132">
        <rect x="20" y="2" width="20" height="8" rx="2" fill={COLORS.textMuted} />
        <rect x="4" y="10" width="52" height="86" rx="8" fill="none" stroke={COLORS.border} strokeWidth="3" />
        <rect x="8" y={10 + 82 * (1 - fillPct / 100) + 4} width="44" height={82 * (fillPct / 100) - 4} rx="4" fill={meta.color} opacity="0.85" />
      </svg>
      <div style={{ textAlign: "center", marginTop: -6, fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>{soh.toFixed(0)}%</div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: COLORS.textMuted, padding: "10px 0" }}>{text}</div>;
}

function AlertRow({ a }: { a: AnomalyItem; key?: React.Key }) {
  const tone = a.severity === "high" ? COLORS.red : a.severity === "medium" ? COLORS.amber : COLORS.textSecondary;
  const soft = a.severity === "high" ? COLORS.redSoft : a.severity === "medium" ? COLORS.amberSoft : "rgba(126,147,160,0.1)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: soft }}>
      <AlertTriangle size={14} color={tone} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, fontSize: 12.5, color: COLORS.textPrimary }}>
        Abnormal <strong>{a.feature}</strong> detected
        <span style={{ color: COLORS.textSecondary }}> — cycle {a.cycle}</span>
      </div>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: tone, textTransform: "uppercase" }}>{a.severity}</span>
    </div>
  );
}

/* ============================================================
   SCREEN VIEWS
   ============================================================ */
function OverviewScreen({
  vehicle,
  onOpenDoctor,
  onOpenScan,
}: {
  vehicle: BatteryVehicle;
  onOpenDoctor: () => void;
  onOpenScan: () => void;
}) {
  const meta = RISK_META[vehicle.risk];
  const recentAnomaly = vehicle.anomalies[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Holographic Diagnostic Scan CTA Banner */}
      <div style={{
        background: `linear-gradient(135deg, rgba(34,217,122,0.12), ${COLORS.surfaceAlt})`,
        border: "1px solid rgba(34,217,122,0.3)",
        borderRadius: 14,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,217,122,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: COLORS.green }}>
            <Scan size={18} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.textPrimary }}>
              Interactive Holographic Pack Scan Available
            </div>
            <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
              Inspect live laser tomography, 1RC EKF innovation residuals, and cell thermal distribution.
            </div>
          </div>
        </div>
        <button
          onClick={onOpenScan}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: COLORS.green,
            color: "#05080A",
            border: "none",
            fontSize: 12,
            fontWeight: 700,
            borderRadius: 8,
            padding: "8px 14px",
            cursor: "pointer"
          }}
        >
          Launch Holographic Scan <ChevronRight size={14} />
        </button>
      </div>

      <div style={{ background: `linear-gradient(135deg, ${COLORS.surface}, ${COLORS.surfaceAlt})`, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 22, display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
        <BatteryGlyph soh={vehicle.soh} risk={vehicle.risk} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 }}>{vehicle.model}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.textPrimary, marginBottom: 10 }}>{vehicle.name}</div>
          <RiskBadge risk={vehicle.risk} />
          {recentAnomaly && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: COLORS.textSecondary, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={13} color={COLORS.amber} />
              Latest flag: {recentAnomaly.feature} at cycle {recentAnomaly.cycle}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 22 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.textPrimary }}>82%</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>State of Charge</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.textPrimary }}>{Math.round(vehicle.ratedCapacity * 0.82 * 4.1)}</div>
            <div style={{ fontSize: 11, color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>Est. Range (km)</div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <MetricCard label="State of Health" value={vehicle.soh.toFixed(1)} unit="%" accent={meta.color} sub={`${vehicle.history.length} cycles logged`} />
        <MetricCard
          label="Remaining Useful Life"
          value={vehicle.rul.status === "past-threshold" ? "At threshold" : vehicle.rul.status === "flat" ? "5+" : `${vehicle.rul.yearsLow}–${vehicle.rul.yearsHigh}`}
          unit={vehicle.rul.status === "normal" || vehicle.rul.status === "flat" ? "yrs" : ""}
          sub={vehicle.rul.status === "past-threshold" ? "Below 80% SoH threshold" : `~${vehicle.rul.cyclesRemaining} cycles to threshold`}
        />
        <MetricCard label="Pack Temperature" value={vehicle.last.temp} unit="°C" accent={vehicle.last.temp > 38 ? COLORS.amber : COLORS.textPrimary} sub="Last logged reading" />
        <MetricCard label="Risk Level" value={meta.label} accent={meta.color} sub={`${vehicle.anomalies.length} flag(s) on record`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14 }}>
        <SectionCard title="Capacity / SoH trend" icon={TrendingDown}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={vehicle.forecast}>
              <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
              <XAxis dataKey="cycle" stroke={COLORS.textMuted} fontSize={11} tickLine={false} />
              <YAxis domain={[Math.max(40, EOL_THRESHOLD - 15), 100]} stroke={COLORS.textMuted} fontSize={11} tickLine={false} width={32} />
              <Tooltip content={<UnitTooltip unit="%" />} />
              <Line type="monotone" dataKey="historical" name="Observed SoH" stroke={COLORS.green} dot={false} strokeWidth={2} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="Predicted SoH" stroke={COLORS.purple} strokeDasharray="5 4" dot={false} strokeWidth={2} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Live telemetry" icon={Activity}>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={vehicle.history.slice(-40)}>
              <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
              <XAxis dataKey="cycle" stroke={COLORS.textMuted} fontSize={11} tickLine={false} />
              <YAxis stroke={COLORS.textMuted} fontSize={11} tickLine={false} width={32} />
              <Tooltip content={<UnitTooltip />} />
              <Line type="monotone" dataKey="temp" name="Temp °C" stroke={COLORS.amber} dot={false} strokeWidth={1.8} />
            </LineChart>
          </ResponsiveContainer>
        </SectionCard>

        <SectionCard title="Anomaly & risk feed" icon={AlertTriangle}>
          {vehicle.anomalies.length === 0 ? (
            <EmptyRow text="No anomalies detected in this battery's history." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {vehicle.anomalies.slice(0, 4).map((a, i) => (
                <AlertRow key={i} a={a} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="AI recommendation" icon={Sparkles} right={
          <button onClick={onOpenDoctor} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: `1px solid ${COLORS.border}`, color: COLORS.textSecondary, fontSize: 11.5, borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
            Open AI Doctor <ChevronRight size={13} />
          </button>
        }>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: COLORS.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={16} color={COLORS.purple} />
            </div>
            <div style={{ fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.5 }}>
              Top factor: <strong style={{ color: COLORS.textPrimary }}>{vehicle.factors[0].label}</strong> ({vehicle.factors[0].pct}% contribution). Open AI Doctor for a full, grounded explanation and a recommended action.
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function BatteryHealthScreen({ vehicle }: { vehicle: BatteryVehicle }) {
  const meta = RISK_META[vehicle.risk];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <MetricCard label="State of Health" value={vehicle.soh.toFixed(1)} unit="%" accent={meta.color} sub="XGBoost SoH model" />
        <MetricCard label="Rated Capacity" value={vehicle.ratedCapacity} unit="kWh" sub={`Now ~${(vehicle.ratedCapacity * vehicle.soh / 100).toFixed(1)} kWh`} />
        <MetricCard label="Cycle Count" value={vehicle.history.length} unit="cycles" />
        <MetricCard
          label="Predicted RUL"
          value={vehicle.rul.status === "past-threshold" ? "0" : vehicle.rul.status === "flat" ? "5+" : `${vehicle.rul.yearsLow}–${vehicle.rul.yearsHigh}`}
          unit="yrs"
          sub={vehicle.rul.status === "past-threshold" ? "At/below 80% threshold" : "Confidence range"}
        />
      </div>
      <SectionCard title="Capacity fade — full cycle history" icon={TrendingDown}>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={vehicle.history}>
            <defs>
              <linearGradient id="sohFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
            <XAxis dataKey="cycle" stroke={COLORS.textMuted} fontSize={11} tickLine={false} />
            <YAxis domain={[Math.max(40, EOL_THRESHOLD - 15), 100]} stroke={COLORS.textMuted} fontSize={11} tickLine={false} width={32} />
            <Tooltip content={<UnitTooltip unit="%" />} />
            <Area type="monotone" dataKey="soh" name="SoH" stroke={meta.color} fill="url(#sohFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function TelemetryScreen({ vehicle }: { vehicle: BatteryVehicle }) {
  const [metric, setMetric] = useState<'voltage' | 'current' | 'temp' | 'resistance'>("voltage");
  const options = [
    { key: "voltage" as const, label: "Voltage (V)", color: "#7FD8A8" },
    { key: "current" as const, label: "Current (A)", color: "#5FB8E0" },
    { key: "temp" as const, label: "Temperature (°C)", color: COLORS.amber },
    { key: "resistance" as const, label: "Resistance (mΩ)", color: COLORS.purple },
  ];
  const active = options.find((o) => o.key === metric)!;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard
        title="Telemetry time series"
        icon={Activity}
        right={
          <div style={{ display: "flex", gap: 6 }}>
            {options.map((o) => (
              <button
                key={o.key}
                onClick={() => setMetric(o.key)}
                style={{
                  background: metric === o.key ? COLORS.greenSoft : COLORS.surfaceAlt,
                  color: metric === o.key ? COLORS.green : COLORS.textSecondary,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: 11, borderRadius: 8, padding: "5px 10px", cursor: "pointer"
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      >
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={vehicle.history}>
            <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
            <XAxis dataKey="cycle" stroke={COLORS.textMuted} fontSize={11} tickLine={false} />
            <YAxis stroke={COLORS.textMuted} fontSize={11} tickLine={false} width={40} />
            <Tooltip content={<UnitTooltip unit={active.label.match(/\(([^)]+)\)/)?.[1]} />} />
            <Line type="monotone" dataKey={metric} name={active.label} stroke={active.color} dot={false} strokeWidth={1.8} />
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function DegradationScreen({ vehicle }: { vehicle: BatteryVehicle }) {
  const [showForecast, setShowForecast] = useState(true);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard title="Historical vs. predicted capacity" icon={TrendingDown}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={vehicle.forecast}>
            <CartesianGrid stroke={COLORS.borderSoft} vertical={false} />
            <XAxis dataKey="cycle" stroke={COLORS.textMuted} fontSize={11} tickLine={false} />
            <YAxis domain={[Math.max(30, EOL_THRESHOLD - 20), 100]} stroke={COLORS.textMuted} fontSize={11} tickLine={false} width={32} />
            <Tooltip content={<UnitTooltip unit="%" />} />
            <Legend wrapperStyle={{ fontSize: 12, color: COLORS.textSecondary }} />
            <Line type="monotone" dataKey="historical" name="Observed" stroke={COLORS.green} dot={false} strokeWidth={2} connectNulls={false} />
            {showForecast && <Line type="monotone" dataKey="forecast" name="Predicted" stroke={COLORS.purple} strokeDasharray="5 4" dot={false} strokeWidth={2} connectNulls={false} />}
          </LineChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

function ChargingScreen({ vehicle }: { vehicle: BatteryVehicle }) {
  const latest = vehicle.sessions[0];
  const toneColor: Record<string, string> = { green: COLORS.green, amber: COLORS.amber, red: COLORS.red, blue: "#5FB8E0" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SectionCard title="Most recent charging session" icon={Plug}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `${toneColor[latest.cls.tone]}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BatteryCharging size={20} color={toneColor[latest.cls.tone]} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: COLORS.textPrimary, fontSize: 14 }}>{latest.cls.label}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{latest.mode} · {latest.powerKw} kW · {latest.durationMin} min</div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AlertsScreen({ vehicle }: { vehicle: BatteryVehicle }) {
  return (
    <SectionCard title="Anomaly & fault feed" icon={AlertTriangle}>
      {vehicle.anomalies.length === 0 ? (
        <EmptyRow text="No anomalies detected across this battery's logged history." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {vehicle.anomalies.map((a, i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: 14, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: COLORS.surfaceAlt }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, fontSize: 13.5 }}>Abnormal {a.feature}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 3 }}>
                  Detected at cycle {a.cycle} · score {a.score}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ============================================================
   MAIN PLATFORM COMPONENT
   ============================================================ */
const NAV_ITEMS = [
  { key: "overview", label: "Overview", Icon: Gauge },
  { key: "scan", label: "Vehicle Scan", Icon: Scan },
  { key: "cells", label: "Cell Grid", Icon: Layers },
  { key: "health", label: "Battery Health", Icon: Battery },
  { key: "telemetry", label: "Telemetry", Icon: Activity },
  { key: "degradation", label: "Degradation", Icon: TrendingDown },
  { key: "charging", label: "Charging", Icon: BatteryCharging },
  { key: "alerts", label: "Alerts", Icon: AlertTriangle },
];

export default function EvBmsPlatform() {
  const fleet = useMemo(() => buildFleet(), []);
  const [selectedId, setSelectedId] = useState(fleet[0].id);
  const [screen, setScreen] = useState("overview");
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const vehicle = fleet.find((v) => v.id === selectedId) || fleet[0];

  return (
    <div style={{ background: COLORS.bg, minHeight: "100vh", display: "flex", fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif", color: COLORS.textPrimary }}>
      {/* Sidebar */}
      <div style={{ width: 208, flexShrink: 0, background: COLORS.surface, borderRight: `1px solid ${COLORS.border}`, display: "flex", flexDirection: "column", padding: "18px 12px", gap: 3 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 10px 20px" }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: COLORS.greenSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={16} color={COLORS.green} />
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: COLORS.textPrimary, lineHeight: 1.15 }}>
            EV Battery<br />Intelligence
          </div>
        </div>

        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => { setScreen(item.key); setSettingsOpen(false); }}
            style={{
              display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none",
              background: screen === item.key && !settingsOpen ? COLORS.greenSoft : "transparent",
              color: screen === item.key && !settingsOpen ? COLORS.green : COLORS.textSecondary,
              fontSize: 13, fontWeight: screen === item.key && !settingsOpen ? 600 : 500, cursor: "pointer", textAlign: "left", width: "100%",
            }}
          >
            <item.Icon size={16} />
            {item.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          onClick={() => setSettingsOpen((s) => !s)}
          style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, border: "none",
            background: settingsOpen ? COLORS.greenSoft : "transparent",
            color: settingsOpen ? COLORS.green : COLORS.textSecondary,
            fontSize: 13, fontWeight: 500, cursor: "pointer", textAlign: "left", width: "100%",
          }}
        >
          <Settings size={16} />
          Settings
        </button>
      </div>

      {/* Main Container */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Top Bar */}
        <div style={{ height: 64, flexShrink: 0, borderBottom: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center", padding: "0 22px", gap: 18, background: COLORS.bg }}>
          <div style={{ position: "relative" }}>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ background: COLORS.surfaceAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "8px 30px 8px 12px", color: COLORS.textPrimary, fontSize: 13, fontWeight: 600, appearance: "none", cursor: "pointer" }}
            >
              {fleet.map((v) => (
                <option key={v.id} value={v.id}>{v.name} — {RISK_META[v.risk].label}</option>
              ))}
            </select>
            <Car size={14} color={COLORS.textMuted} style={{ position: "absolute", right: 10, top: 11, pointerEvents: "none" }} />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.green }}>
            <Wifi size={13} color={COLORS.green} />
            ML Backend Active
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: COLORS.textMuted }}>
            <Clock size={13} />
            Live telemetry stream
          </div>
        </div>

        {/* Screen Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 22 }}>
          {settingsOpen ? (
            <SectionCard title="Settings & System Status" icon={Settings} style={{ maxWidth: 540 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>End-of-life threshold</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.textPrimary }}>80% SoH</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: COLORS.textSecondary }}>FastAPI ML Backend</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.green }}>Loaded (XGBoost + EKF Physics)</span>
                </div>
              </div>
            </SectionCard>
          ) : (
            <>
              {screen === "overview" && (
                <OverviewScreen
                  vehicle={vehicle}
                  onOpenDoctor={() => setDoctorOpen(true)}
                  onOpenScan={() => setScreen("scan")}
                />
              )}
              {screen === "scan" && (
                <EvDiagnosticScan
                  vehicleName={vehicle.name}
                  chemistry={vehicle.name.includes("LFP") ? "LFP" : "NMC 811"}
                  soh={vehicle.soh}
                  soc={84}
                  temperature={vehicle.last.temp}
                  onOpenDoctor={() => setDoctorOpen(true)}
                />
              )}
              {screen === "cells" && (
                <CellGridMonitor
                  cellCount={96}
                  chemistry={vehicle.name.includes("LFP") ? "LFP" : "NMC"}
                  vehicleName={vehicle.name}
                />
              )}
              {screen === "health" && <BatteryHealthScreen vehicle={vehicle} />}
              {screen === "telemetry" && <TelemetryScreen vehicle={vehicle} />}
              {screen === "degradation" && <DegradationScreen vehicle={vehicle} />}
              {screen === "charging" && <ChargingScreen vehicle={vehicle} />}
              {screen === "alerts" && <AlertsScreen vehicle={vehicle} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
