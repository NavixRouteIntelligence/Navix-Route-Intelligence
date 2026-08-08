import { tollCostBetween, tollMatrix, type TollGate } from './toll-cost';

/** Pontos alinhados: o pórtico fica exatamente no meio de A→B. */
const A = { latitude: 38.7, longitude: -9.2 };
const B = { latitude: 38.7, longitude: -9.1 };
const MEIO: TollGate = { latitude: 38.7, longitude: -9.15, radiusKm: 0.5, cost: 2.15 };

/** Fora do caminho: mesmo comprimento de trecho, pórtico ao lado. */
const FORA: TollGate = { latitude: 38.8, longitude: -9.15, radiusKm: 0.5, cost: 2.15 };

/** Muito mais longe, e sem pórtico no caminho. */
const LONGE = { latitude: 41.15, longitude: -8.62 };

describe('tollCostBetween', () => {
  it('trecho que passa no pórtico paga o valor declarado', () => {
    expect(tollCostBetween(A, B, [MEIO])).toBeCloseTo(2.15, 2);
  });

  it('pórtico fora do caminho não cobra', () => {
    expect(tollCostBetween(A, B, [FORA])).toBe(0);
  });

  // O ponto central da ADR-0111: portagem é fato do troço, não do quilómetro.
  // O trecho muito mais longo custa **menos** portagem que o curto com pórtico.
  it('distância não determina portagem', () => {
    const curtoComPortico = tollCostBetween(A, B, [MEIO]);
    const longoSemPortico = tollCostBetween(A, LONGE, [MEIO]);

    expect(longoSemPortico).toBe(0);
    expect(curtoComPortico).toBeGreaterThan(longoSemPortico);
  });

  it('pórticos somam quando o trecho passa em mais de um', () => {
    expect(tollCostBetween(A, B, [MEIO, { ...MEIO, cost: 1 }])).toBeCloseTo(3.15, 2);
  });

  it('sem pórticos, não há custo', () => {
    expect(tollCostBetween(A, B, [])).toBe(0);
  });
});

describe('tollMatrix', () => {
  // `null` e zero são estados diferentes: "não paga" não é "não sabemos".
  it('sem pórticos configurados devolve null, não uma matriz de zeros', () => {
    expect(tollMatrix([A, B], [])).toBeNull();
  });

  it('com pórticos, a diagonal é zero e o par que passa cobra', () => {
    const m = tollMatrix([A, B], [MEIO])!;

    expect(m[0][0]).toBe(0);
    expect(m[1][1]).toBe(0);
    expect(m[0][1]).toBeCloseTo(2.15, 2);
    expect(m[1][0]).toBeCloseTo(2.15, 2);
  });
});
