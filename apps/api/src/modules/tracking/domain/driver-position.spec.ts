import { effectiveStatus, OFFLINE_AFTER_MS } from './driver-position';

describe('effectiveStatus', () => {
  const now = new Date('2026-07-08T12:00:00Z');

  it('mantém en_route quando a posição é recente', () => {
    const recent = new Date(now.getTime() - 10_000);
    expect(effectiveStatus('en_route', recent, now)).toBe('en_route');
  });

  it('vira offline quando a posição está velha', () => {
    const old = new Date(now.getTime() - OFFLINE_AFTER_MS - 1);
    expect(effectiveStatus('en_route', old, now)).toBe('offline');
  });

  it('finished permanece finished mesmo velho', () => {
    const old = new Date(now.getTime() - OFFLINE_AFTER_MS - 1);
    expect(effectiveStatus('finished', old, now)).toBe('finished');
  });
});
