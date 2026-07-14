import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type {
  CostAugmentation,
  CostAugmentationInput,
  CostAugmentationPort,
} from '../../domain/ports/cost-augmentation.port';
import { riskSurchargeAt } from '../../domain/risk-zone';

/**
 * Provedor de sobretaxas configurável (ADR-0024): aplica **zonas de risco** (do
 * config) como sobretaxa de nó. Sem zonas configuradas, é **no-op** (default
 * retrocompatível). Pedágio depende de dados de grafo de um provedor de mapas —
 * fica como port aberta (aqui, sem efeito); a preferência `avoidTolls` do veículo
 * já viaja no input para quando esse provedor existir.
 */
@Injectable()
export class ConfigurableCostAugmentation implements CostAugmentationPort {
  constructor(private readonly config: AppConfigService) {}

  augment(input: CostAugmentationInput): CostAugmentation {
    const zones = this.config.optimizer.riskZones;
    if (zones.length === 0) return {};

    const nodeSurcharge = input.points.map((p) => riskSurchargeAt(p, zones));
    return nodeSurcharge.some((s) => s > 0) ? { nodeSurcharge } : {};
  }
}
