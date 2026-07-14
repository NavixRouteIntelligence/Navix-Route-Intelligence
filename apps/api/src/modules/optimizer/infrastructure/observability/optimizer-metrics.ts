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
  }

  observeSolve(strategy: string, seconds: number, stops: number): void {
    this.solveDuration.observe({ strategy }, seconds);
    this.stops.observe({ strategy }, stops);
  }

  markInfeasible(): void {
    this.infeasible.inc();
  }
}
