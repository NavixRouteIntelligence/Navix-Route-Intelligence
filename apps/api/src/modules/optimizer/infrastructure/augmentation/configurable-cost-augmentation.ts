import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../../../shared/config/app-config.service';
import type {
  CostAugmentation,
  CostAugmentationInput,
  CostAugmentationPort,
} from '../../domain/ports/cost-augmentation.port';
import { riskSurchargeAt } from '../../domain/risk-zone';
import { tollMatrix } from '../../domain/toll-cost';

/**
 * Provedor de sobretaxas configurável (ADR-0024, ampliado na ADR-0111).
 *
 * Aplica **zonas de risco** como sobretaxa de nó e **custo de portagem** por
 * trecho, a partir dos pórticos declarados pelo operador. Antes o pedágio era
 * `no-op` — e o preset "evitar portagens" amplificava uma sobretaxa que nunca
 * existia, o que fazia o modo não ter efeito nenhum.
 *
 * Sem zonas nem pórticos, segue sendo no-op e retrocompatível.
 */
@Injectable()
export class ConfigurableCostAugmentation implements CostAugmentationPort {
  constructor(private readonly config: AppConfigService) {}

  augment(input: CostAugmentationInput): CostAugmentation {
    const { riskZones, tollGates } = this.config.optimizer;
    const out: CostAugmentation = {};

    if (riskZones.length > 0) {
      const nodeSurcharge = input.points.map((p) => riskSurchargeAt(p, riskZones));
      if (nodeSurcharge.some((s) => s > 0)) out.nodeSurcharge = nodeSurcharge;
    }

    // `avoidTolls` do perfil do veículo não zera o custo: ele diz a preferência,
    // e é o **peso** do objetivo que decide o quanto ela vale (ADR-0111).
    const tolls = tollMatrix(input.points, tollGates);
    if (tolls) out.tollMatrix = tolls;

    return out;
  }
}
