import { describe, it, expect, vi } from 'vitest';
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

  it('notifies status listeners on status change subscription', () => {
    const statusFn = vi.fn();
    const unsubscribe = telemetrySocket.onStatusChange(statusFn);
    expect(statusFn).toHaveBeenCalledWith(false);
    unsubscribe();
  });

  it('returns false when sending data on a closed socket', () => {
    const sent = telemetrySocket.send({ type: 'TEST' });
    expect(sent).toBe(false);
  });

  it('provides selectVehicle and selectScenario methods without throwing when disconnected', () => {
    expect(() => telemetrySocket.selectVehicle('tesla-m3')).not.toThrow();
    expect(() => telemetrySocket.selectScenario('healthy-new')).not.toThrow();
  });
});

