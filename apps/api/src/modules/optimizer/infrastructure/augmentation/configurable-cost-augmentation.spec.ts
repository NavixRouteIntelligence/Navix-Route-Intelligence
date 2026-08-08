import type { TollGate } from '../../domain/toll-cost';
import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { RiskZone } from '../../domain/risk-zone';
import { ConfigurableCostAugmentation } from './configurable-cost-augmentation';

function configWith(riskZones: RiskZone[], tollGates: TollGate[] = []): AppConfigService {
  return { optimizer: { riskZones, tollGates } } as AppConfigService;
}

const input = {
  points: [
    { latitude: 0, longitude: 0 }, // dentro da zona
    { latitude: 10, longitude: 10 }, // fora
  ],
  avoidTolls: false,
};

describe('ConfigurableCostAugmentation', () => {
  it('sem zonas configuradas: no-op (retrocompatível)', () => {
    const aug = new ConfigurableCostAugmentation(configWith([]));
    expect(aug.augment(input)).toEqual({});
  });

  it('aplica a penalidade de zona de risco como sobretaxa de nó', () => {
    const aug = new ConfigurableCostAugmentation(
      configWith([{ latitude: 0, longitude: 0, radiusKm: 5, penalty: 25 }]),
    );
    const { nodeSurcharge } = aug.augment(input);
    expect(nodeSurcharge).toEqual([25, 0]);
  });

  it('zonas configuradas mas nenhum ponto dentro: no-op', () => {
    const aug = new ConfigurableCostAugmentation(
      configWith([{ latitude: 80, longitude: 80, radiusKm: 1, penalty: 25 }]),
    );
    expect(aug.augment(input)).toEqual({});
  });
});

// NAV-4.12 / ADR-0111: o custo de portagem passa a existir. Antes o provedor
// era `no-op` para pedágio, e o preset "evitar portagens" amplificava uma
// sobretaxa que nunca era produzida.
describe('ConfigurableCostAugmentation — custo de portagem', () => {
  const A = { latitude: 38.7, longitude: -9.2 };
  const B = { latitude: 38.7, longitude: -9.1 };
  const MEIO: TollGate = { latitude: 38.7, longitude: -9.15, radiusKm: 0.5, cost: 2.15 };

  it('sem pórticos, não devolve matriz de portagem', () => {
    const out = new ConfigurableCostAugmentation(configWith([])).augment({
      points: [A, B],
      avoidTolls: false,
    });

    // Ausente, não zerada: "não sabemos" não é "não paga".
    expect(out.tollMatrix).toBeUndefined();
  });

  it('com pórticos, o trecho que passa recebe o custo declarado', () => {
    const out = new ConfigurableCostAugmentation(configWith([], [MEIO])).augment({
      points: [A, B],
      avoidTolls: false,
    });

    expect(out.tollMatrix![0][1]).toBeCloseTo(2.15, 2);
    expect(out.tollMatrix![0][0]).toBe(0);
  });

  it('portagem e zona de risco convivem no mesmo resultado', () => {
    const zona: RiskZone = { latitude: 38.7, longitude: -9.2, radiusKm: 1, penalty: 5 };

    const out = new ConfigurableCostAugmentation(configWith([zona], [MEIO])).augment({
      points: [A, B],
      avoidTolls: false,
    });

    expect(out.nodeSurcharge?.[0]).toBe(5);
    expect(out.tollMatrix).toBeDefined();
  });
});
