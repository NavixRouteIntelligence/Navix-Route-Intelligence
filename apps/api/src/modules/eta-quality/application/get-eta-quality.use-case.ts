import { Inject, Injectable } from '@nestjs/common';

import { summarize, type EtaQualitySummary } from '../domain/eta-observation';
import {
  ETA_OBSERVATION_REPOSITORY,
  type EtaObservationRepositoryPort,
} from '../domain/ports/eta-observation-repository.port';

/** Janela padrão do resumo — o mesmo horizonte da agregação coletiva (ADR-0031). */
const DEFAULT_WINDOW_DAYS = 30;
const MAX_SAMPLES = 5000;

/**
 * Resumo da qualidade do ETA do tenant (ADR-0087).
 *
 * Existe além da métrica Prometheus porque este é o número que decide se um
 * modelo entra em produção, e quem decide precisa conseguir olhá-lo sem montar
 * um Grafana — e por tenant, que é a granularidade em que a rota varia.
 */
@Injectable()
export class GetEtaQualityUseCase {
  constructor(
    @Inject(ETA_OBSERVATION_REPOSITORY)
    private readonly observations: EtaObservationRepositoryPort,
  ) {}

  async execute(tenantId: string, windowDays = DEFAULT_WINDOW_DAYS): Promise<EtaQualitySummary> {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const errors = await this.observations.recentErrors(tenantId, since, MAX_SAMPLES);
    return summarize(errors);
  }
}
