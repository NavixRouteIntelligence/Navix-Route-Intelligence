import type { EtaObservation } from '../eta-observation';

/** Port do corpus de medições de ETA (ADR-0087). Tudo escopado por tenant (RLS). */
export interface EtaObservationRepositoryPort {
  /**
   * Grava a medição. **Idempotente**: uma segunda gravação para a mesma
   * entrega é ignorada, porque o listener pode reprocessar o mesmo evento e a
   * conclusão é um fato único. Devolve `true` quando a linha foi criada.
   */
  record(observation: EtaObservation): Promise<boolean>;

  /** Erros (com sinal) das medições recentes; `null` para as sem previsão. */
  recentErrors(tenantId: string, since: Date, limit: number): Promise<(number | null)[]>;

  /**
   * Amostras rotuladas para treino (ADR-0090), **da mais antiga para a mais
   * recente** — a divisão treino/teste é temporal. Só medições com previsão:
   * sem ela não há resíduo a aprender.
   */
  trainingSamples(
    tenantId: string,
    since: Date,
    limit: number,
  ): Promise<
    { errorMinutes: number; correctionMinutes: number; predictedArrivalAt: Date }[]
  >;
}

export const ETA_OBSERVATION_REPOSITORY = Symbol('ETA_OBSERVATION_REPOSITORY');
