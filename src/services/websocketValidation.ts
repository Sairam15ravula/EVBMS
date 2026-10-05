/**
 * WebSocket Control Message Validation
 * Defines schemas and validation for client-to-server control messages.
 */

export interface SelectVehicleMessage {
  type: 'SELECT_VEHICLE';
  vehicleId: string;
}

export interface SelectScenarioMessage {
  type: 'SELECT_SCENARIO';
  scenarioId: string;
}

export type WebSocketControlMessage = SelectVehicleMessage | SelectScenarioMessage;

export const MAX_WS_PAYLOAD_SIZE = 1024; // 1KB max payload

/**
 * Validates an incoming WebSocket control message.
 * Returns true if the message matches a known schema, false otherwise.
 */
export function validateControlMessage(data: unknown): data is WebSocketControlMessage {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const msg = data as Record<string, unknown>;

  if (msg.type === 'SELECT_VEHICLE') {
    return typeof msg.vehicleId === 'string' && msg.vehicleId.length > 0;
  }

  if (msg.type === 'SELECT_SCENARIO') {
    return typeof msg.scenarioId === 'string' && msg.scenarioId.length > 0;
  }

  return false;
}

/**
 * Checks if a raw payload exceeds the maximum allowed size.
 */
export function isPayloadTooLarge(rawMessage: Buffer | string): boolean {
  const size = typeof rawMessage === 'string' ? Buffer.byteLength(rawMessage, 'utf8') : rawMessage.length;
  return size > MAX_WS_PAYLOAD_SIZE;
}
