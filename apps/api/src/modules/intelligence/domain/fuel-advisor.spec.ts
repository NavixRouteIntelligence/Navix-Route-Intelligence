import { adviseFuel } from './fuel-advisor';

describe('adviseFuel', () => {
  it('estima o consumo pela distância e perfil do veículo', () => {
    const advice = adviseFuel('car', 100); // 8 L/100km
    expect(advice.estimatedConsumption).toBe(8);
    expect(advice.unit).toBe('L');
  });

  it('recomenda abastecer quando a autonomia atual não cobre a rota com margem', () => {
    // carro, 10% de 50L = 5L → ~62 km de autonomia; rota de 200 km.
    const advice = adviseFuel('car', 200, 10);
    expect(advice.refuelRecommended).toBe(true);
    expect(advice.estimatedRangeKm).toBeGreaterThan(0);
  });

  it('não recomenda quando há autonomia com folga', () => {
    const advice = adviseFuel('car', 50, 90);
    expect(advice.refuelRecommended).toBe(false);
  });

  it('bicicleta: sem combustível', () => {
    const advice = adviseFuel('bicycle', 20, 0);
    expect(advice.estimatedConsumption).toBe(0);
    expect(advice.refuelRecommended).toBe(false);
    expect(advice.estimatedRangeKm).toBeNull();
  });
});
