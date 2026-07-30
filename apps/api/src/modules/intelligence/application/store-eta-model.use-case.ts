import { Inject, Injectable } from '@nestjs/common';

import type { EtaCorrection } from '../domain/eta-correction';
import {
  ETA_CORRECTION_REPOSITORY,
  type EtaCorrectionRepositoryPort,
} from '../domain/ports/eta-correction-repository.port';
import { EtaCorrectionService } from './eta-correction.service';

/**
 * Publica um modelo treinado (ADR-0090).
 *
 * Fica no Intelligence — que **serve** o modelo — enquanto o treino fica em
 * quem tem os rótulos (`eta_observations`, ADR-0087). A separação evita o ciclo
 * de módulos e espelha o que já foi feito com as features: quem mede empurra,
 * quem serve guarda.
 */
@Injectable()
export class StoreEtaModelUseCase {
  constructor(
    @Inject(ETA_CORRECTION_REPOSITORY)
    private readonly repository: EtaCorrectionRepositoryPort,
    private readonly service: EtaCorrectionService,
  ) {}

  async execute(tenantId: string, corrections: EtaCorrection[]): Promise<void> {
    await this.repository.replace(tenantId, corrections, new Date());
    // Sem isto o modelo novo só valeria depois do TTL do cache — e quem acabou
    // de treinar espera ver o efeito agora.
    this.service.invalidate(tenantId);
  }

  currentModel(tenantId: string): Promise<EtaCorrection[]> {
    return this.repository.findAll(tenantId);
  }
}
