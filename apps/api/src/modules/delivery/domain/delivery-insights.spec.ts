import { aggregateDeliveryInsights, type InsightInput } from './delivery-insights';

function i(city: string, hour: number): InsightInput {
  return { city, hour };
}

describe('aggregateDeliveryInsights (FASE 3, F2)', () => {
  it('vazio: totais zerados e bests null', () => {
    const r = aggregateDeliveryInsights([]);
    expect(r.totalDelivered).toBe(0);
    expect(r.bestRegion).toBeNull();
    expect(r.bestHour).toBeNull();
    expect(r.byHour).toHaveLength(24);
    expect(r.byHour.every((h) => h.deliveries === 0)).toBe(true);
  });

  it('melhor região = cidade de maior volume', () => {
    const r = aggregateDeliveryInsights([i('Lisboa', 9), i('Lisboa', 10), i('Porto', 9)]);
    expect(r.bestRegion).toBe('Lisboa');
    expect(r.topRegions[0]).toEqual({ city: 'Lisboa', deliveries: 2 });
    expect(r.topRegions).toHaveLength(2);
  });

  it('melhor horário = hora de maior volume', () => {
    const r = aggregateDeliveryInsights([i('X', 9), i('X', 9), i('X', 14)]);
    expect(r.bestHour).toBe(9);
    expect(r.byHour[9].deliveries).toBe(2);
    expect(r.byHour[14].deliveries).toBe(1);
  });

  it('ignora cidade vazia; top limita a 5', () => {
    const many = Array.from({ length: 7 }, (_, k) => i(`C${k}`, 8));
    const r = aggregateDeliveryInsights([...many, i('  ', 8)]);
    expect(r.topRegions).toHaveLength(5);
    expect(r.totalDelivered).toBe(8); // a de cidade vazia conta no total, não nas regiões
  });

  it('empate de região resolvido por ordem alfabética', () => {
    const r = aggregateDeliveryInsights([i('Braga', 9), i('Aveiro', 9)]);
    expect(r.topRegions.map((t) => t.city)).toEqual(['Aveiro', 'Braga']);
  });
});
