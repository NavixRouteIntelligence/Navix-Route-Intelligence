import { Injectable } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Métricas no formato Prometheus (via `prom-client`), servidas em `/metrics`.
 *
 * Usa um **`Registry` dedicado** (não o global default) para não colidir ao
 * instanciar em testes e para manter as labels de serviço isoladas. Registra as
 * métricas padrão de processo/Node (CPU, memória, event loop, GC, handles) e
 * duas métricas de HTTP (latência em histograma + contador), alimentadas pelo
 * `HttpMetricsInterceptor`. As labels de rota usam o **template** da rota
 * (`/deliveries/:id`), não a URL concreta — evita explosão de cardinalidade.
 */
@Injectable()
export class MetricsService {
  readonly registry: Registry;
  readonly httpDuration: Histogram<'method' | 'route' | 'status_code'>;
  readonly httpTotal: Counter<'method' | 'route' | 'status_code'>;

  constructor() {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ service: process.env.OTEL_SERVICE_NAME ?? 'navix-api' });
    collectDefaultMetrics({ register: this.registry });

    this.httpDuration = new Histogram({
      name: 'http_server_request_duration_seconds',
      help: 'Duração das requisições HTTP em segundos.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.httpTotal = new Counter({
      name: 'http_server_requests_total',
      help: 'Total de requisições HTTP concluídas.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });
  }

  /** Registra uma requisição concluída (chamado pelo interceptor). */
  observeHttp(method: string, route: string, statusCode: number, seconds: number): void {
    const labels = { method, route, status_code: String(statusCode) };
    this.httpDuration.observe(labels, seconds);
    this.httpTotal.inc(labels);
  }

  /** Exposição textual no formato Prometheus. */
  scrape(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
