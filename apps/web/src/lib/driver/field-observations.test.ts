import type { VoiceCommandView } from '@navix/contracts';
import { describe, expect, it } from 'vitest';

import { dwellMinutes, MAX_DWELL_MINUTES, reportedParkingDifficulty } from './field-observations';

describe('dwellMinutes', () => {
  it('converte o intervalo em minutos (1 casa)', () => {
    expect(dwellMinutes(0, 6 * 60_000)).toBe(6);
    expect(dwellMinutes(0, 90_000)).toBe(1.5);
  });

  it('nunca é negativo', () => {
    expect(dwellMinutes(10_000, 0)).toBe(0);
  });

  it('satura no teto aceito pela API', () => {
    expect(dwellMinutes(0, 10 * 60 * 60_000)).toBe(MAX_DWELL_MINUTES);
  });
});

describe('reportedParkingDifficulty', () => {
  const base: VoiceCommandView = { intent: 'report_parking', confidence: 0.7, slots: {} };

  it('usa o slot quando a fala indica a dificuldade', () => {
    expect(reportedParkingDifficulty({ ...base, slots: { parkingDifficulty: 'moderate' } })).toBe('moderate');
  });

  it('assume hard quando a fala não especifica', () => {
    expect(reportedParkingDifficulty(base)).toBe('hard');
  });
});
