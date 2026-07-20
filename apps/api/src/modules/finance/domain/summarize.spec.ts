import { summarize, type SummaryEntry } from './summarize';

function e(type: 'income' | 'expense', cents: number, category = 'other', odometerKm: number | null = null): SummaryEntry {
  return { type, amountCents: cents, category, odometerKm };
}

describe('summarize (FASE 3, F1)', () => {
  it('soma receitas e despesas e o saldo', () => {
    const r = summarize([e('income', 10000), e('expense', 3000), e('income', 5000)], 0);
    expect(r.totalIncomeCents).toBe(15000);
    expect(r.totalExpenseCents).toBe(3000);
    expect(r.balanceCents).toBe(12000);
  });

  it('km rodados = intervalo de hodômetro dos abastecimentos (>=2)', () => {
    const r = summarize(
      [e('expense', 6000, 'fuel', 100000), e('expense', 6500, 'fuel', 100400)],
      0,
    );
    expect(r.distanceKm).toBe(400);
    // custo/km = despesa(125.00€) / 400 km = 0.3125 → 0.31
    expect(r.costPerKm).toBe(0.31);
  });

  it('sem 2 leituras de combustível, distância e custo/km ficam null', () => {
    const r = summarize([e('expense', 6000, 'fuel', 100000)], 0);
    expect(r.distanceKm).toBeNull();
    expect(r.costPerKm).toBeNull();
  });

  it('lucro/entrega = saldo ÷ entregas; null sem entregas', () => {
    const r = summarize([e('income', 10000), e('expense', 4000)], 3);
    expect(r.profitPerDelivery).toBe(20); // 60.00€ / 3
    expect(summarize([e('income', 10000)], 0).profitPerDelivery).toBeNull();
  });
});
