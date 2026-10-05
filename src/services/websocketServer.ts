import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { VEHICLE_PRESETS, SCENARIO_PRESETS, generateLiveTelemetryFrame } from '../data/batteryData';
import { BatteryTelemetry } from '../types';
import { validateControlMessage, isPayloadTooLarge } from './websocketValidation';

export const MAX_WS_CONNECTIONS = 50;
export const MAX_MESSAGES_PER_SECOND = 10;

export interface WebSocketTelemetryStats {
  activeConnections: number;
  maxConnections: number;
  totalMessagesSent: number;
  path: string;
}

class TelemetryWebSocketManager {
  private wss: WebSocketServer | null = null;
  private totalMessagesSent = 0;

  public initialize(server: HttpServer, path = '/ws/telemetry'): WebSocketServer {
    this.wss = new WebSocketServer({ server, path });

    this.wss.on('connection', (ws: WebSocket, req) => {
      if (this.wss && this.wss.clients.size > MAX_WS_CONNECTIONS) {
        console.warn(`[WS Gateway] Connection rejected: exceeded max limit (${MAX_WS_CONNECTIONS})`);
        ws.close(1013, 'Max connection capacity reached');
        return;
      }

      console.log(`[WS Gateway] New telemetry client connected from ${req.socket.remoteAddress}`);

      // Client message rate limiter tracking
      let messageCounter = 0;
      const rateResetTimer = setInterval(() => {
        messageCounter = 0;
      }, 1000);

      // Default stream configuration for client
      let currentVehicle = VEHICLE_PRESETS[0];
      let currentScenario = SCENARIO_PRESETS[0];
      let step = 0;

      // Broadcast live telemetry frame every 1 second
      const streamTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          step++;
          const frame: BatteryTelemetry = generateLiveTelemetryFrame(currentVehicle, currentScenario, step);
          ws.send(JSON.stringify(frame));
          this.totalMessagesSent++;
        }
      }, 1000);

      // Handle client incoming configuration or control messages
      ws.on('message', (rawMessage) => {
        messageCounter++;
        if (messageCounter > MAX_MESSAGES_PER_SECOND) {
          console.warn('[WS Gateway] Client message rate limit exceeded. Closing connection.');
          ws.close(1008, 'Message rate limit exceeded');
          return;
        }

        // Enforce max payload size (1KB)
        if (isPayloadTooLarge(rawMessage as Buffer)) {
          console.warn('[WS Gateway] Payload exceeds max size (1KB). Closing connection.');
          ws.close(1008, 'Payload too large');
          return;
        }

        try {
          const data = JSON.parse(rawMessage.toString());

          // Validate message against schema
          if (!validateControlMessage(data)) {
            console.warn('[WS Gateway] Invalid control message received. Closing connection.');
            ws.close(1008, 'Invalid message format');
            return;
          }

          if (data.type === 'SELECT_VEHICLE') {
            const found = VEHICLE_PRESETS.find(v => v.id === data.vehicleId);
            if (found) currentVehicle = found;
          }
          if (data.type === 'SELECT_SCENARIO') {
            const found = SCENARIO_PRESETS.find(s => s.id === data.scenarioId);
            if (found) currentScenario = found;
          }
        } catch (e) {
          console.warn('[WS Gateway] Failed to parse client message:', (e as Error).message);
          ws.close(1008, 'Malformed message');
        }
      });

      ws.on('close', () => {
        clearInterval(streamTimer);
        clearInterval(rateResetTimer);
        console.log('[WS Gateway] Client disconnected');
      });

      ws.on('error', (err) => {
        console.error('[WS Gateway] Client error:', err);
        clearInterval(streamTimer);
        clearInterval(rateResetTimer);
      });
    });

    console.log(`[WS Gateway] Telemetry WebSocket server initialized on ${path}`);
    return this.wss;
  }

  public getStats(): WebSocketTelemetryStats {
    return {
      activeConnections: this.wss ? this.wss.clients.size : 0,
      maxConnections: MAX_WS_CONNECTIONS,
      totalMessagesSent: this.totalMessagesSent,
      path: '/ws/telemetry',
    };
  }
}

export const telemetryWsManager = new TelemetryWebSocketManager();
