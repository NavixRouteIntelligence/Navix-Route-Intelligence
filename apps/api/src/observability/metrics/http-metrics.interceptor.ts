import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { MetricsService } from './metrics.service';

/**
 * Mede duração e volume das requisições HTTP e alimenta o `MetricsService`.
 * **Puramente observacional** — não toca no fluxo nem na resposta (não altera
 * regra de negócio). Usa o template da rota como label (baixa cardinalidade).
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const start = process.hrtime.bigint();
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const record = (statusCode: number): void => {
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.observeHttp(req.method, this.routeOf(req), statusCode, seconds);
    };

    return next.handle().pipe(
      tap({
        next: () => record(res.statusCode),
        error: (err: { status?: number }) => record(err?.status ?? 500),
      }),
    );
  }

  /** Template da rota (`/deliveries/:id`), com fallback seguro para não explodir cardinalidade. */
  private routeOf(req: Request): string {
    const route = (req as Request & { route?: { path?: string } }).route;
    if (route?.path) {
      const base = (req.baseUrl ?? '').replace(/\/$/, '');
      return `${base}${route.path}` || route.path;
    }
    return 'unmatched';
  }
}
