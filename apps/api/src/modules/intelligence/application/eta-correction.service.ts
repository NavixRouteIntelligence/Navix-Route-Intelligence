import { Inject, Injectable, Logger } from '@nestjs/common';

import { bucketsFor } from '../domain/cell-features';
import { correctionFor, type EtaCorrection } from '../domain/eta-correction';
import {
  ETA_CORRECTION_REPOSITORY,
  type EtaCorrectionRepositoryPort,
} from '../domain/ports/eta-correction-repository.port';

/** Quanto tempo o modelo de um tenant fica em cache. */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * API pública do Intelligence para o modelo de ETA (ADR-0090).
 *
 * É o **ponto de troca**: o Optimizer consulta esta port e soma o que ela
 * devolve à previsão da heurística. Enquanto não houver modelo treinado ela
 * devolve zero, e o comportamento é byte a byte o de antes — ou seja, a
 * infraestrutura entra em produção desligada, e ligar é treinar.
 *
 * Trocar a mediana por regressão, gradient boosting ou o que vier depois é
 * trocar `correctionFor` por outra função: nem o Optimizer nem os consumidores
 * de ETA (rastreio público, avisos ao destinatário) tomam conhecimento.
 */
export interface EtaCorrectionPort {
  /** Minutos a somar à previsão da heurística. Zero sem modelo. */
  correctionMinutes(tenantId: string, arrivalAt: Date): Promise<number>;
}

export const ETA_CORRECTION = Symbol('ETA_CORRECTION');

interface CacheEntry {
  corrections: EtaCorrection[];
  expiresAt: number;
}

@Injectable()
export class EtaCorrectionService implements EtaCorrectionPort {
  private readonly logger = new Logger('EtaCorrection');
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(ETA_CORRECTION_REPOSITORY)
    private readonly repository: EtaCorrectionRepositoryPort,
  ) {}

  async correctionMinutes(tenantId: string, arrivalAt: Date): Promise<number> {
    try {
      const corrections = await this.load(tenantId);
      // O contexto é o da **chegada prevista**, não o de agora: uma parada
      // prevista para as 18h deve ser corrigida pelo que se sabe das 18h.
      return correctionFor(corrections, bucketsFor(arrivalAt));
    } catch (err) {
      // Falhar aqui degrada para a heurística, que é um resultado utilizável.
      // Derrubar a previsão inteira porque o modelo não carregou, não é.
      this.logger.warn(
        `Modelo de ETA indisponível, usando a heurística: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return 0;
    }
  }

  /** Invalida o cache — chamado após treinar, para o modelo novo valer já. */
  invalidate(tenantId: string): void {
    this.cache.delete(tenantId);
  }

  private async load(tenantId: string): Promise<EtaCorrection[]> {
    const hit = this.cache.get(tenantId);
    if (hit && hit.expiresAt > Date.now()) return hit.corrections;

    const corrections = await this.repository.findAll(tenantId);
    this.cache.set(tenantId, { corrections, expiresAt: Date.now() + CACHE_TTL_MS });
    return corrections;
  }
}
