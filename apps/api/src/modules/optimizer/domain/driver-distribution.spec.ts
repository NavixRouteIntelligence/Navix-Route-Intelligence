import { distributeAmongDrivers, type DistributionStop } from './driver-distribution';

/** Paradas espalhadas de forma determinística em torno de um centro. */
function stops(n: number): DistributionStop[] {
  return Array.from({ length: n }, (_, i) => ({
    point: { latitude: -23.5 + i * 0.01, longitude: -46.6 + (i % 3) * 0.01 },
  }));
}

describe('distributeAmongDrivers (ADR-0101)', () => {
  it('reparte todas as paradas quando há motorista — nada sobra', () => {
    const { perDriver, unassigned } = distributeAmongDrivers(stops(9), 3, null);

    expect(unassigned).toEqual([]);
    expect(perDriver.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('equilibra a contagem em ~N/V', () => {
    const { perDriver } = distributeAmongDrivers(stops(10), 3, null);

    // teto de 10/3 = 4; ninguém carrega mais que isso.
    for (const cluster of perDriver) expect(cluster.length).toBeLessThanOrEqual(4);
    expect(perDriver.flat()).toHaveLength(10);
  });

  it('não duplica nem perde parada', () => {
    const { perDriver, unassigned } = distributeAmongDrivers(stops(17), 4, null);

    const todos = [...perDriver.flat(), ...unassigned].sort((a, b) => a - b);
    expect(todos).toEqual(Array.from({ length: 17 }, (_, i) => i));
    expect(new Set(todos).size).toBe(17);
  });

  it('sem motorista ativo, devolve tudo como não distribuído — e não inventa dono', () => {
    const { perDriver, unassigned } = distributeAmongDrivers(stops(5), 0, null);

    expect(perDriver).toEqual([]);
    expect(unassigned).toEqual([0, 1, 2, 3, 4]);
  });

  it('sem paradas, cada motorista fica com uma lista vazia', () => {
    const { perDriver, unassigned } = distributeAmongDrivers([], 2, null);

    expect(perDriver).toEqual([[], []]);
    expect(unassigned).toEqual([]);
  });

  it('um motorista só recebe tudo', () => {
    const { perDriver } = distributeAmongDrivers(stops(6), 1, null);

    expect(perDriver[0]).toHaveLength(6);
  });

  it('é determinística: mesma entrada, mesmo recorte', () => {
    const entrada = stops(11);

    expect(distributeAmongDrivers(entrada, 3, null)).toEqual(
      distributeAmongDrivers(entrada, 3, null),
    );
  });

  it('agrupa por janela horária antes do ângulo — quem sai junto, anda junto', () => {
    const manha = new Date('2026-08-03T09:00:00Z');
    const tarde = new Date('2026-08-03T15:00:00Z');
    const comJanela: DistributionStop[] = [
      { point: { latitude: -23.50, longitude: -46.60 }, timeWindow: { start: manha, end: manha } },
      { point: { latitude: -23.90, longitude: -46.90 }, timeWindow: { start: tarde, end: tarde } },
      { point: { latitude: -23.51, longitude: -46.61 }, timeWindow: { start: manha, end: manha } },
      { point: { latitude: -23.91, longitude: -46.91 }, timeWindow: { start: tarde, end: tarde } },
    ];

    const { perDriver } = distributeAmongDrivers(comJanela, 2, null);

    // As duas da manhã (0 e 2) não podem cair em motoristas diferentes das
    // duas da tarde (1 e 3) — a varredura ordena por janela antes do ângulo.
    const doPrimeiro = new Set(perDriver[0]);
    expect(doPrimeiro.has(0) === doPrimeiro.has(2)).toBe(true);
  });
});
