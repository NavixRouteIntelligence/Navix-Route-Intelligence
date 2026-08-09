import { Inject, Injectable } from '@nestjs/common';
import type { KaizenDailyView } from '@navix/contracts';

import { CACHE, type CachePort } from '../../../shared/cache/cache.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import { confidenceOf, deltaOf, highlightsOf } from '../domain/kaizen-daily';

import { GetDriverDailySnapshotUseCase } from './get-driver-daily-snapshot.use-case';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Passado máximo consultável (ADR-0120).
 *
 * Não é limite de retenção: é o alcance da pergunta. O resumo é uma ferramenta
 * do dia seguinte, e permitir "há dois anos" convidaria a varrer o histórico
 * inteiro por uma rota que existe para responder sobre ontem.
 */
export const MAX_PAST_DAYS = 90;

/** Segundos de cache. Curto: a projeção pode chegar a qualquer momento. */
export const CACHE_TTL_SECONDS = 60;

/**
 * Resumo diário do próprio motorista (ADR-0120).
 *
 * Compõe o que já existe — fotografia (ADR-0117), baseline (ADR-0118) e
 * recomendação (ADR-0119) — e acrescenta apenas o que faltava para a app: os
 * deltas explícitos, os destaques e a **confiança com as suas razões**.
 *
 * Nada aqui recalcula métrica. Se um número desta resposta divergir do read
 * model, o defeito está a montante, não neste ficheiro.
 */
@Injectable()
export class GetKaizenDailyUseCase {
  constructor(
    private readonly snapshots: GetDriverDailySnapshotUseCase,
    @Inject(CACHE) private readonly cache: CachePort,
  ) {}

  async execute(
    tenantId: string,
    userId: string,
    day?: string,
    agora = new Date(),
  ): Promise<KaizenDailyView> {
    const dia = this.validar(day, agora);
    // Chave por tenant **e** utilizador **e** dia: partilhar cache entre
    // pessoas seria a forma mais silenciosa possível de vazar o resumo de
    // alguém para outra pessoa.
    const chave = `kaizen:daily:${tenantId}:${userId}:${dia ?? 'ontem'}`;

    return this.cache.getOrSet(chave, CACHE_TTL_SECONDS, () =>
      this.montar(tenantId, userId, dia, agora),
    );
  }

  private async montar(
    tenantId: string,
    userId: string,
    dia: string | undefined,
    agora: Date,
  ): Promise<KaizenDailyView> {
    const foto = await this.snapshots.execute(tenantId, userId, dia, agora);
    const baseline = foto.baseline ?? null;
    const { confidence, reasons } = confidenceOf(foto, baseline);

    return {
      day: foto.day,
      status: foto.state,
      metrics: {
        delivered: foto.delivered,
        failed: foto.failed,
        onTime: foto.onTime,
        successRate: foto.successRate,
        onTimeRate: foto.onTimeRate,
        activeMinutes: foto.activeMinutes,
        savings: foto.savings,
      },
      ...(baseline
        ? {
            baseline,
            deltas: {
              delivered: deltaOf(baseline.delivered),
              successRate: deltaOf(baseline.successRate),
              onTimeRate: deltaOf(baseline.onTimeRate),
              activeMinutes: deltaOf(baseline.activeMinutes),
            },
          }
        : {}),
      highlights: baseline ? highlightsOf(baseline) : [],
      ...(foto.recommendation ? { recommendation: foto.recommendation } : {}),
      confidence,
      reasons,
    };
  }

  /**
   * `day` ausente é legítimo — significa ontem. O que é recusado é um dia
   * malformado, no futuro, ou para além do alcance da pergunta.
   */
  private validar(day: string | undefined, agora: Date): string | undefined {
    if (day === undefined) return undefined;
    if (!ISO_DAY.test(day)) throw new ValidationError('Dia inválido: use YYYY-MM-DD.');

    const pedido = Date.parse(`${day}T00:00:00Z`);
    if (Number.isNaN(pedido)) throw new ValidationError('Dia inválido: use YYYY-MM-DD.');

    const hoje = Date.parse(`${agora.toISOString().slice(0, 10)}T00:00:00Z`);
    if (pedido > hoje) throw new ValidationError('Dia no futuro não tem resumo.');
    if ((hoje - pedido) / 86_400_000 > MAX_PAST_DAYS) {
      throw new ValidationError(`Dia fora do intervalo: máximo ${MAX_PAST_DAYS} dias.`);
    }
    return day;
  }
}
