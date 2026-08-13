import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

import { MetricsService } from '../../../../observability/metrics/metrics.service';

/**
 * Métricas de performance do motor de otimização (ADR-0022), registradas no
 * **Registry compartilhado** do MetricsService (reuso da observabilidade —
 * ADR-0021), expostas em `/metrics` para Prometheus/Grafana.
 */
@Injectable()
export class OptimizerMetrics {
  private readonly solveDuration: Histogram<'strategy'>;
  private readonly stops: Histogram<'strategy'>;
  private readonly infeasible: Counter<string>;
  private readonly planOutcome: Counter<'status'>;
  private readonly planWrite: Counter<'outcome'>;
  private readonly queueJobFailure: Counter<'queue' | 'outcome'>;
  private readonly queueError: Counter<'queue' | 'kind'>;
  private readonly matrix: Counter<'outcome' | 'profile'>;
  private readonly matrixLatency: Histogram<'outcome'>;
  private readonly matrixFallback: Counter<'kind'>;
  private readonly matrixHttp: Counter<'status'>;
  private readonly matrixCoordsExceeded: Counter<string>;
  private readonly geometry: Counter<'outcome'>;
  private readonly geometryHttp: Counter<'status'>;
  private readonly geometryCache: Counter<'result'>;
  private readonly reoptimizeTrigger: Histogram<string>;
  private readonly reoptimizeSkipped: Counter<'reason'>;

  constructor(metrics: MetricsService) {
    const registers = [metrics.registry];
    this.solveDuration = new Histogram({
      name: 'optimizer_solve_duration_seconds',
      help: 'Duração da resolução da rota (estratégia) em segundos.',
      labelNames: ['strategy'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers,
    });
    this.stops = new Histogram({
      name: 'optimizer_route_stops',
      help: 'Número de paradas por rota otimizada.',
      labelNames: ['strategy'],
      buckets: [2, 5, 10, 25, 50, 100, 250, 500],
      registers,
    });
    this.infeasible = new Counter({
      name: 'optimizer_capacity_infeasible_total',
      help: 'Rotas cuja demanda excede a capacidade do veículo.',
      registers,
    });
    // Sucesso completo × sucesso parcial (ADR-0110). Antes, ambos apareciam
    // como "job succeeded": uma rota que deixou três entregas para trás era
    // indistinguível, na observabilidade, de uma que atendeu tudo.
    this.planOutcome = new Counter({
      name: 'optimizer_plan_outcome_total',
      help: 'Planos produzidos, por estado (completed | partial).',
      labelNames: ['status'] as const,
      registers,
    });
    // Quem ficou gravado × quem chegou tarde (ADR-0113). Antes o descarte era
    // um `return` silencioso: não havia como saber que a rota de um motorista
    // estava sendo recalculada mais vezes do que o solver conseguia entregar.
    this.planWrite = new Counter({
      name: 'optimizer_plan_write_total',
      help: 'Gravações de plano, por desfecho (saved | discarded).',
      labelNames: ['outcome'] as const,
      registers,
    });
    // Falhas de job na fila, separando a tentativa que ainda vai voltar da que
    // esgotou (ADR-0114). O log nomeia o job; a métrica é o que dispara alerta
    // quando a taxa de `exhausted` sai do zero — cada uma é uma rota que
    // ninguém vai receber.
    this.queueJobFailure = new Counter({
      name: 'optimizer_queue_job_failures_total',
      help: 'Jobs falhos na fila, por desfecho (retrying | exhausted).',
      labelNames: ['queue', 'outcome'] as const,
      registers,
    });
    // Erros da própria fila (conexão), distintos de um job que falhou: aqui o
    // problema é a infraestrutura, não o trabalho.
    this.queueError = new Counter({
      name: 'optimizer_queue_errors_total',
      help: 'Erros de infraestrutura da fila, por tipo.',
      labelNames: ['queue', 'kind'] as const,
      registers,
    });
    // Matriz do provedor externo (ADR-0126). Rótulos fechados: `outcome` e
    // `profile` têm poucos valores, e o status HTTP é um código, não uma URL.
    this.matrix = new Counter({
      name: 'optimizer_matrix_requests_total',
      help: 'Matrizes pedidas ao provedor, por desfecho e perfil.',
      labelNames: ['outcome', 'profile'] as const,
      registers,
    });
    this.matrixLatency = new Histogram({
      name: 'optimizer_matrix_duration_seconds',
      help: 'Tempo até a matriz ficar pronta (ou falhar).',
      labelNames: ['outcome'] as const,
      buckets: [0.1, 0.25, 0.5, 1, 2, 4, 8],
      registers,
    });
    this.matrixFallback = new Counter({
      name: 'optimizer_matrix_fallback_total',
      help: 'Quedas para a matriz geométrica, por causa.',
      labelNames: ['kind'] as const,
      registers,
    });
    this.matrixHttp = new Counter({
      name: 'optimizer_matrix_http_errors_total',
      help: 'Respostas HTTP não-OK do provedor, por status.',
      labelNames: ['status'] as const,
      registers,
    });
    this.matrixCoordsExceeded = new Counter({
      name: 'optimizer_matrix_coords_exceeded_total',
      help: 'Matrizes acima do teto de ladrilhamento, que caem em geometria.',
      registers,
    });
    this.geometry = new Counter({
      name: 'optimizer_route_geometry_total',
      // Sem traçado a rota funciona à mesma, então isto não é um alarme — é o
      // que distingue «ninguém pediu» de «pedimos e não veio», que de outra
      // forma se parecem exatamente no ecrã do motorista.
      help: 'Pedidos de traçado real, por desfecho.',
      labelNames: ['outcome'] as const,
      registers,
    });
    this.geometryHttp = new Counter({
      name: 'optimizer_route_geometry_http_errors_total',
      help: 'Respostas HTTP não-OK da Directions, por status.',
      labelNames: ['status'] as const,
      registers,
    });
    this.geometryCache = new Counter({
      name: 'optimizer_route_geometry_cache_total',
      // A taxa de acerto é o que separa uma conta previsível de uma surpresa:
      // cada falha é uma chamada paga à Directions, e uma queda súbita nela é
      // o primeiro sinal de que alguma coisa mudou na chave do cache.
      help: 'Leituras do cache de traçado, por resultado.',
      labelNames: ['result'] as const,
      registers,
    });
    // SLA da reotimização dinâmica (ADR-0083): do evento de domínio até o job
    // enfileirado — inclui o debounce, que é o maior componente controlável.
    this.reoptimizeTrigger = new Histogram({
      name: 'optimizer_reoptimization_trigger_seconds',
      help: 'Do evento (entrega alterada/atraso) até a reotimização ser enfileirada.',
      buckets: [0.5, 1, 2, 3, 5, 10, 20, 30, 60],
      registers,
    });
    this.reoptimizeSkipped = new Counter({
      name: 'optimizer_reoptimization_skipped_total',
      help: 'Reotimizações não executadas, por motivo (ex.: plano sem direito).',
      labelNames: ['reason'],
      registers,
    });
  }

  observeSolve(strategy: string, seconds: number, stops: number): void {
    this.solveDuration.observe({ strategy }, seconds);
    this.stops.observe({ strategy }, stops);
  }

  /** Registra o desfecho do plano (ADR-0110). Falha não chega aqui: não há plano. */
  observePlanOutcome(status: 'completed' | 'partial'): void {
    this.planOutcome.inc({ status });
  }

  /**
   * Gravações que ficaram vs. resultados descartados por chegarem tarde
   * (ADR-0113). Descarte é desfecho normal, mas uma taxa que sobe diz que a
   * frota está pedindo reotimização mais rápido do que o solver entrega.
   */
  observePlanWrite(outcome: 'saved' | 'discarded'): void {
    this.planWrite.inc({ outcome });
  }

  /** Falha de job na fila (ADR-0114). `exhausted`: acabaram as tentativas. */
  observeQueueJobFailure(queue: string, outcome: 'retrying' | 'exhausted'): void {
    this.queueJobFailure.inc({ queue, outcome });
  }

  /** Desfecho e latência de uma matriz pedida ao provedor (ADR-0126). */
  observeMatrix(outcome: string, profile: string, seconds: number): void {
    this.matrix.inc({ outcome, profile });
    this.matrixLatency.observe({ outcome }, seconds);
  }

  /** Queda para geometria, com a causa categorizada. */
  /** `outcome` vem de um conjunto fechado: sem cardinalidade de cliente. */
  observeGeometry(outcome: string): void {
    this.geometry.inc({ outcome });
  }

  observeGeometryCache(result: 'hit' | 'miss'): void {
    this.geometryCache.inc({ result });
  }

  observeGeometryHttp(status: number): void {
    this.geometryHttp.inc({ status: String(status) });
  }

  observeMatrixFallback(kind: string): void {
    this.matrixFallback.inc({ kind });
  }

  observeMatrixHttp(status: number): void {
    this.matrixHttp.inc({ status: String(status) });
  }

  /** Acima do teto de ladrilhamento — o número de pontos não vira rótulo. */
  observeMatrixCoordsExceeded(_points: number): void {
    this.matrixCoordsExceeded.inc();
  }

  /** Erro de infraestrutura da fila — conexão, não trabalho (ADR-0114). */
  observeQueueError(queue: string, kind: 'connection'): void {
    this.queueError.inc({ queue, kind });
  }

  markInfeasible(): void {
    this.infeasible.inc();
  }

  observeReoptimizationTrigger(seconds: number): void {
    this.reoptimizeTrigger.observe(seconds);
  }

  reoptimizationSkipped(reason: string): void {
    this.reoptimizeSkipped.inc({ reason });
  }
}
