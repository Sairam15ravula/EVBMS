/**
 * Client-Side WebSocket Service for EV Battery Telemetry Gateway (/ws/telemetry).
 * Handles WebSocket connection lifecycle, auto-reconnection, and selective subscription callbacks.
 */
import { BatteryTelemetry } from '../types';

type TelemetryCallback = (data: BatteryTelemetry) => void;
type StatusCallback = (connected: boolean) => void;

class TelemetrySocketClient {
  private socket: WebSocket | null = null;
  private subscribers: Set<TelemetryCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();
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
        this.setConnectedStatus(true);
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
        this.setConnectedStatus(false);
        console.log('[TelemetrySocket] Disconnected from WebSocket Gateway. Scheduling reconnect...');
        this.scheduleReconnect(wsUrl);
      };

      this.socket.onerror = (err) => {
        console.error('[TelemetrySocket] Error:', err);
        this.setConnectedStatus(false);
        this.socket?.close();
      };
    } catch (err) {
      console.error('[TelemetrySocket] Failed to create WebSocket connection:', err);
      this.setConnectedStatus(false);
      this.scheduleReconnect(wsUrl);
    }
  }

  private setConnectedStatus(status: boolean) {
    if (this.isConnected !== status) {
      this.isConnected = status;
      this.statusListeners.forEach((listener) => listener(status));
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

  public onStatusChange(callback: StatusCallback): () => void {
    this.statusListeners.add(callback);
    // Immediately notify with current status
    callback(this.isConnected);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  public send(message: any): boolean {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  public selectVehicle(vehicleId: string): void {
    this.send({ type: 'SELECT_VEHICLE', vehicleId });
  }

  public selectScenario(scenarioId: string): void {
    this.send({ type: 'SELECT_SCENARIO', scenarioId });
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }
}

export const telemetrySocket = new TelemetrySocketClient();

