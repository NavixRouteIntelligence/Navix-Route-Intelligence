import { BALANCED_WEIGHTS, estimateCo2Kg, smartWeights, weightsFor } from './economy';

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

describe('smartWeights (Modo inteligente — ADR-0066)', () => {
  it('sem janelas nem urgência: cai no balanceado', () => {
    const w = smartWeights([
      { priority: 'normal', hasTimeWindow: false },
      { priority: 'low', hasTimeWindow: false },
    ]);
    expect(w).toEqual(BALANCED_WEIGHTS);
  });

  it('muitas janelas: peso de janela sobe', () => {
    const w = smartWeights([
      { priority: 'normal', hasTimeWindow: true },
      { priority: 'normal', hasTimeWindow: true },
    ]);
    expect(w.timeWindow).toBeGreaterThan(BALANCED_WEIGHTS.timeWindow);
    expect(w.timeWindow).toBeCloseTo(0.6, 5); // 0.1 + 1.0*0.5
  });

  it('muitos urgentes: peso de prioridade sobe', () => {
    const w = smartWeights([
      { priority: 'urgent', hasTimeWindow: false },
      { priority: 'high', hasTimeWindow: false },
    ]);
    expect(w.priority).toBeGreaterThan(BALANCED_WEIGHTS.priority);
    expect(w.priority).toBeCloseTo(0.3, 5); // 0.05 + 1.0*0.25
  });

  it('metade urgente e metade com janela: ajuste proporcional', () => {
    const w = smartWeights([
      { priority: 'urgent', hasTimeWindow: true },
      { priority: 'normal', hasTimeWindow: false },
    ]);
    expect(w.timeWindow).toBeCloseTo(0.35, 5); // 0.1 + 0.5*0.5
    expect(w.priority).toBeCloseTo(0.18, 5); // 0.05 + 0.5*0.25, arredondado a 2 casas
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
