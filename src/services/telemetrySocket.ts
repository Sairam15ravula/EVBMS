/**
 * Client-Side WebSocket Service for EV Battery Telemetry Gateway (/ws/telemetry).
 * Handles WebSocket connection lifecycle, auto-reconnection, and selective subscription callbacks.
 */
import { BatteryTelemetry } from '../types';

type TelemetryCallback = (data: BatteryTelemetry) => void;

class TelemetrySocketClient {
  private socket: WebSocket | null = null;
  private subscribers: Set<TelemetryCallback> = new Set();
  private isConnected = false;
  private reconnectTimer: any = null;

  public connect(url?: string) {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = url || `${protocol}//${window.location.host}/ws/telemetry`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        console.log('[TelemetrySocket] Connected to Express WebSocket Gateway:', wsUrl);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      };

      this.socket.onmessage = (event) => {
        try {
          const frame: BatteryTelemetry = JSON.parse(event.data);
          this.subscribers.forEach((callback) => callback(frame));
        } catch (e) {
          console.error('[TelemetrySocket] Error parsing WebSocket frame:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        console.log('[TelemetrySocket] Disconnected from WebSocket Gateway. Scheduling reconnect...');
        this.scheduleReconnect(wsUrl);
      };

      this.socket.onerror = (err) => {
        console.error('[TelemetrySocket] Error:', err);
        this.socket?.close();
      };
    } catch (err) {
      console.error('[TelemetrySocket] Failed to create WebSocket connection:', err);
      this.scheduleReconnect(wsUrl);
    }
  }

  private scheduleReconnect(url: string) {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect(url);
    }, 3000);
  }

  public subscribe(callback: TelemetryCallback): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const telemetrySocket = new TelemetrySocketClient();
