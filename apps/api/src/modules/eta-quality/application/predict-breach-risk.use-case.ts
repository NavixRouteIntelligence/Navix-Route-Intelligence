import { Inject, Injectable } from '@nestjs/common';

import {
  errorsForContext,
  estimateBreachRisk,
  type BreachRisk,
  type ErrorSample,
} from '../../intelligence/domain/breach-risk';
import {
  ETA_OBSERVATION_REPOSITORY,
  type EtaObservationRepositoryPort,
} from '../domain/ports/eta-observation-repository.port';

/** Janela do histórico usada para estimar o erro típico. */
const HISTORY_WINDOW_DAYS = 90;
const MAX_SAMPLES = 5000;

export interface StopToAssess {
  deliveryId: string;
  predictedArrival: Date;
  windowEnd: Date;
}

export interface AssessedStop extends StopToAssess {
  risk: BreachRisk;
}

/**
 * Estima o risco de estouro de janela das paradas informadas (ADR-0091).
 *
 * Vive no módulo que **tem os rótulos** (`eta_observations`, ADR-0087): é o
 * histórico de erro da própria operação que sustenta a probabilidade. A conta
 * em si é pura e mora no domínio do Intelligence.
 *
 * Uma consulta só para todas as paradas: a distribuição de erro é do tenant, e
 * repeti-la por parada seria N+1 no caminho que roda a cada posição recebida.
 */
@Injectable()
export class PredictBreachRiskUseCase {
  constructor(
    @Inject(ETA_OBSERVATION_REPOSITORY)
    private readonly observations: EtaObservationRepositoryPort,
  ) {}

  async execute(tenantId: string, stops: StopToAssess[]): Promise<AssessedStop[]> {
    if (stops.length === 0) return [];

    const since = new Date(Date.now() - HISTORY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const samples: ErrorSample[] = await this.observations.errorSamples(
      tenantId,
      since,
      MAX_SAMPLES,
    );

    const assessed: AssessedStop[] = [];
    for (const stop of stops) {
      // O contexto é o da **chegada prevista**: uma parada das 18h deve ser
      // avaliada pelo que se sabe das 18h, não pelo horário de agora.
      const errors = errorsForContext(samples, stop.predictedArrival);
      const risk = estimateBreachRisk(stop.predictedArrival, stop.windowEnd, errors);
      // Sem histórico não há afirmação a fazer — a parada some da lista em vez
      // de aparecer como "risco baixo", que seria uma garantia inventada.
      if (risk) assessed.push({ ...stop, risk });
    }
    return assessed;
  }
}
