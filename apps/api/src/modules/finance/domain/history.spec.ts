import { bucketHistory, periodKey, type HistoryEntry } from './history';

function e(type: 'income' | 'expense', cents: number, iso: string): HistoryEntry {
  return { type, amountCents: cents, occurredAt: new Date(`${iso}T12:00:00.000Z`) };
}

describe('history (FASE 3, F3)', () => {
  describe('periodKey', () => {
    it('mês → YYYY-MM', () => {
      expect(periodKey(new Date('2026-07-15T00:00:00Z'), 'month')).toBe('2026-07');
    });
    it('semana → segunda-feira (UTC)', () => {
      // 2026-07-15 é uma quarta; a segunda da semana é 2026-07-13.
      expect(periodKey(new Date('2026-07-15T00:00:00Z'), 'week')).toBe('2026-07-13');
      // domingo 2026-07-19 → mesma semana (segunda 2026-07-13).
      expect(periodKey(new Date('2026-07-19T00:00:00Z'), 'week')).toBe('2026-07-13');
    });
  });

  it('agrupa por mês, soma receita/despesa e saldo, ordenado', () => {
    const points = bucketHistory(
      [
        e('income', 10000, '2026-07-05'),
        e('expense', 3000, '2026-07-20'),
        e('income', 5000, '2026-06-10'),
      ],
      'month',
    );
    expect(points.map((p) => p.period)).toEqual(['2026-06', '2026-07']);
    expect(points[1]).toEqual({ period: '2026-07', incomeCents: 10000, expenseCents: 3000, balanceCents: 7000 });
  });

  it('vazio → sem pontos', () => {
    expect(bucketHistory([], 'month')).toEqual([]);
  });
});
