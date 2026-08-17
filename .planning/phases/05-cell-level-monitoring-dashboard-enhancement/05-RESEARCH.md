# Phase 5: Cell-Level Monitoring & Dashboard Enhancement - Research

*Researched: 2026-08-17*

## Key Technical Decisions & Chemistry Thresholds

### 1. Chemistry-Aware Voltage & Thermal Threshold Matrix
```typescript
export interface ChemistryThresholds {
  nominalVoltage: number;
  maxVoltage: number;
  minVoltage: number;
  maxCellDeltaMv: number;
  criticalTempC: number;
}

export const CHEMISTRY_THRESHOLDS: Record<'NMC' | 'LFP', ChemistryThresholds> = {
  NMC: {
    nominalVoltage: 3.70,
    maxVoltage: 4.20,
    minVoltage: 3.00,
    maxCellDeltaMv: 50.0,
    criticalTempC: 55.0,
  },
  LFP: {
    nominalVoltage: 3.20,
    maxVoltage: 3.65,
    minVoltage: 2.50,
    maxCellDeltaMv: 60.0,
    criticalTempC: 60.0,
  },
};
```

### 2. Client-Side WebSocket Service (`src/services/telemetrySocket.ts`)
```typescript
import { BatteryTelemetry } from '../types';

type TelemetryCallback = (data: BatteryTelemetry) => void;

class TelemetrySocketClient {
  private socket: WebSocket | null = null;
  private subscribers: Set<TelemetryCallback> = new Set();

  public connect(url?: string) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws/telemetry`;

    this.socket = new WebSocket(wsUrl);
    this.socket.onmessage = (event) => {
      try {
        const frame: BatteryTelemetry = JSON.parse(event.data);
        this.subscribers.forEach((cb) => cb(frame));
      } catch (e) {}
    };
  }

  public subscribe(cb: TelemetryCallback) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }
}

export const telemetrySocket = new TelemetrySocketClient();
```

## Validation Architecture

### Verification Commands
- `npm run build`
