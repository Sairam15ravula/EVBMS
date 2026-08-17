# Phase 5: Cell-Level Monitoring & Dashboard Enhancement - Context

**Gathered:** 2026-08-17  
**Status:** Ready for planning  

<domain>
## Phase Boundary

This phase elevates the frontend UI user experience with an interactive 96-cell battery monitoring grid (`CellGridMonitor.tsx`), real-time WebSocket telemetry streaming into `EvBmsPlatform.tsx`, multi-vehicle side-by-side comparison analytics (`BmsComparison.tsx`), and context-aware Digital Doctor AI assistant drawer enhancements.

</domain>

<decisions>
## Implementation Decisions

### 1. Interactive Cell-Level Monitoring Grid (`CellGridMonitor.tsx`) (UI-01)
- Render 96-cell pack architecture (8 modules × 12 cells or 12 modules × 8 cells).
- Color-coded voltage status:
  - Normal: 3.65V - 4.15V (Emerald gradient)
  - Imbalanced delta: > 50mV variance (Amber glow)
  - Severe Under/Overvoltage: < 3.2V or > 4.25V (Red alert pulse)
- Thermal Hotspot Heatmap view toggled between Cell Voltage (V) and Cell Temperature (°C).
- Interactive Cell Detail Modal showing individual cell historical voltage curve, internal resistance, and state of health.

### 2. Live WebSocket Dashboard Streaming (`EvBmsPlatform.tsx`) (UI-02)
- Connect React dashboard to Phase 3 Express WebSocket Gateway (`ws://localhost:3000/ws/telemetry` or relative `wss://`).
- Automatic reconnection with exponential backoff on disconnect.
- Smooth metric card counter animations without full page re-renders.

### 3. Advanced Degradation & RUL Scenario Control (`UI-03`)
- Interactive degradation curves with Recharts displaying actual vs. AI predicted capacity fade curves.
- Stress scenario controls (Temperature profiles, Fast charging habits, C-rate sliders).

### 4. Digital Doctor AI Assistant Enhancements (`UI-04`)
- Persist conversation history in session state.
- Suggested quick actions pre-populated from active cell grid anomalies or telemetry alerts.

### 5. Multi-Vehicle Side-by-Side Comparison (`BmsComparison.tsx`) (UI-05)
- Compare two vehicle pack architectures (e.g. Tesla Model 3 NMC vs. BYD Blade LFP) across SoH, RUL cycles, cell count, thermal resistance, and charging speed.

</decisions>

<canonical_refs>
## Canonical References

- `src/EvBmsPlatform.tsx` — Main dashboard application container
- `src/components/` — Existing UI components (`Header.tsx`, `MetricCards.tsx`, `BmsComparison.tsx`, `DigitalDoctorDrawer.tsx`)
- `src/services/websocketServer.ts` — Phase 3 WebSocket telemetry gateway
- `.planning/REQUIREMENTS.md` — UI-01 through UI-05 requirements

</canonical_refs>

---
*Phase: 05-cell-level-monitoring-dashboard-enhancement*
