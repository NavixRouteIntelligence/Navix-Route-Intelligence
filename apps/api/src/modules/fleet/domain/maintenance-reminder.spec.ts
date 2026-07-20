import type { MaintenanceType } from '@navix/contracts';

import { computeReminders, type ReminderInput } from './maintenance-reminder';

const now = new Date('2026-07-20T12:00:00.000Z');

function rec(
  type: MaintenanceType,
  opts: Partial<ReminderInput> = {},
): ReminderInput {
  return {
    type,
    performedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    nextDueDate: null,
    nextDueOdometerKm: null,
    ...opts,
  };
}

describe('computeReminders (FASE 3, V2)', () => {
  it('ignora registros sem vencimento', () => {
    expect(computeReminders([rec('oil_change')], { now, currentOdometerKm: 1000 })).toEqual([]);
  });

  it('vencimento por data: due_soon dentro de 30 dias, overdue no passado', () => {
    const [r] = computeReminders(
      [rec('insurance', { nextDueDate: new Date('2026-08-05T00:00:00.000Z') })],
      { now, currentOdometerKm: null },
    );
    expect(r.status).toBe('due_soon');
    expect(r.remainingDays).toBe(16);

    const [o] = computeReminders(
      [rec('ipo', { nextDueDate: new Date('2026-07-10T00:00:00.000Z') })],
      { now, currentOdometerKm: null },
    );
    expect(o.status).toBe('overdue');
    expect(o.remainingDays).toBeLessThan(0);
  });

  it('vencimento por km: usa o hodômetro atual', () => {
    const [r] = computeReminders(
      [rec('oil_change', { nextDueOdometerKm: 130000 })],
      { now, currentOdometerKm: 129200 },
    );
    expect(r.remainingKm).toBe(800);
    expect(r.status).toBe('due_soon'); // 800 <= 1000
  });

  it('sem hodômetro atual, o km fica null (não inventa)', () => {
    const [r] = computeReminders(
      [rec('tires', { nextDueOdometerKm: 130000 })],
      { now, currentOdometerKm: null },
    );
    expect(r.remainingKm).toBeNull();
    expect(r.status).toBe('ok');
  });

  it('por tipo, usa o registro mais recente com vencimento', () => {
    const result = computeReminders(
      [
        rec('oil_change', {
          performedAt: new Date('2026-02-01T00:00:00.000Z'),
          nextDueOdometerKm: 100000,
        }),
        rec('oil_change', {
          performedAt: new Date('2026-06-01T00:00:00.000Z'),
          nextDueOdometerKm: 140000,
        }),
      ],
      { now, currentOdometerKm: 139000 },
    );
    expect(result).toHaveLength(1);
    expect(result[0].dueOdometerKm).toBe(140000); // o mais recente
  });

  it('ordena os mais urgentes primeiro (overdue antes de due_soon/ok)', () => {
    const result = computeReminders(
      [
        rec('insurance', { nextDueDate: new Date('2027-01-01T00:00:00.000Z') }), // ok
        rec('ipo', { nextDueDate: new Date('2026-07-01T00:00:00.000Z') }), // overdue
      ],
      { now, currentOdometerKm: null },
    );
    expect(result.map((r) => r.type)).toEqual(['ipo', 'insurance']);
  });
});
