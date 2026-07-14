import { haversineKm, riskSurchargeAt, type RiskZone } from './risk-zone';

describe('risk-zone', () => {
  it('haversineKm ~0 para o mesmo ponto', () => {
    expect(haversineKm({ latitude: -23.5, longitude: -46.6 }, { latitude: -23.5, longitude: -46.6 })).toBeCloseTo(0);
  });

  it('soma as penalidades das zonas que contêm o ponto', () => {
    const zones: RiskZone[] = [
      { latitude: 0, longitude: 0, radiusKm: 5, penalty: 10 },
      { latitude: 0, longitude: 0, radiusKm: 1, penalty: 7 },
      { latitude: 50, longitude: 50, radiusKm: 5, penalty: 99 }, // longe
    ];
    // Ponto na origem: dentro das duas primeiras (10+7), fora da terceira.
    expect(riskSurchargeAt({ latitude: 0, longitude: 0 }, zones)).toBe(17);
  });

  it('ponto fora de todas as zonas: sobretaxa 0', () => {
    const zones: RiskZone[] = [{ latitude: 0, longitude: 0, radiusKm: 1, penalty: 10 }];
    expect(riskSurchargeAt({ latitude: 10, longitude: 10 }, zones)).toBe(0);
  });
});
