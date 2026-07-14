import type { AppConfigService } from '../../../../shared/config/app-config.service';
import type { RiskZone } from '../../domain/risk-zone';
import { ConfigurableCostAugmentation } from './configurable-cost-augmentation';

function configWith(riskZones: RiskZone[]): AppConfigService {
  return { optimizer: { riskZones } } as AppConfigService;
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
