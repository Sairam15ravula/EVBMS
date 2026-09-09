import { describe, it, expect } from 'vitest';
import { telemetrySocket } from '../services/telemetrySocket';

describe('TelemetrySocket Service', () => {
  it('initializes in disconnected state', () => {
    expect(telemetrySocket.getIsConnected()).toBe(false);
  });

  it('allows subscribing and unsubscribing callbacks', () => {
    const dummyCallback = () => {};
    const unsubscribe = telemetrySocket.subscribe(dummyCallback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();
  });
});
