import { BALANCED_WEIGHTS, estimateCo2Kg, weightsFor } from './economy';

describe('weightsFor (Modo Economia)', () => {
  it('sem modo: pesos balanceados (legado)', () => {
    expect(weightsFor(undefined)).toEqual(BALANCED_WEIGHTS);
  });

  it('time: valoriza janelas (timeWindow alto)', () => {
    const w = weightsFor('time');
    expect(w.timeWindow).toBeGreaterThan(BALANCED_WEIGHTS.timeWindow);
  });

  it('fuel/co2: minimiza distância (distance alto)', () => {
    expect(weightsFor('fuel').distance).toBeGreaterThan(BALANCED_WEIGHTS.distance);
    expect(weightsFor('co2').distance).toBeGreaterThan(BALANCED_WEIGHTS.distance);
  });

  it('tolls: amplifica a sobretaxa (evita pedágio)', () => {
    expect(weightsFor('tolls').surcharge).toBeGreaterThan(1);
  });
});

describe('estimateCo2Kg', () => {
  it('carro por 100 km: ~8 L × 2.31 kg/L', () => {
    expect(estimateCo2Kg('car', 100)).toBeCloseTo(18.48, 2);
  });

  it('bicicleta: sem emissão', () => {
    expect(estimateCo2Kg('bicycle', 100)).toBe(0);
  });
});
