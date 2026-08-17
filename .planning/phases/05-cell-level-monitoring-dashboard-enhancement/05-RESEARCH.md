# Phase 5: Cell-Level Monitoring & Dashboard Enhancement - Research

*Researched: 2026-08-17*

## Key Technical Decisions & UI Components

### 1. 96-Cell Grid Architecture (`CellGridMonitor.tsx`)
- Grid layout: 12 rows × 8 columns or 8 modules × 12 cells.
- Cell state color mapping:
  - `voltage >= 4.2` or `voltage <= 3.0`: `bg-red-500/20 text-red-400 border-red-500/50 animate-pulse`
  - `delta > 0.050`: `bg-amber-500/20 text-amber-400 border-amber-500/50`
  - `normal`: `bg-emerald-500/10 text-emerald-300 border-emerald-500/30`

### 2. WebSocket Telemetry Client Hook (`useWebSocketTelemetry.ts`)
```typescript
import { useEffect, useState } from 'react';
import { BatteryTelemetry } from '../types';

export function useWebSocketTelemetry(wsUrl: string) {
  const [telemetry, setTelemetry] = useState<BatteryTelemetry | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const url = wsUrl || `${protocol}//${host}/ws/telemetry`;

    const ws = new WebSocket(url);
    ws.onopen = () => setIsConnected(true);
    ws.onmessage = (evt) => {
      try {
        const frame = JSON.parse(evt.data);
        setTelemetry(frame);
      } catch (e) {}
    };
    ws.onclose = () => setIsConnected(false);
    return () => ws.close();
  }, [wsUrl]);

  return { telemetry, isConnected };
}
```

## Validation Architecture

### Verification Commands
- `npm run dev` and visual UI inspection in browser
