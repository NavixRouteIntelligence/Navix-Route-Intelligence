import { Controller, Get, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { MetricsService } from './metrics.service';

/**
 * Endpoint de scrape do Prometheus. Fora do prefixo `/api` e sem versão
 * (`/metrics` — excluído do prefixo global em `main.ts`). **Público**: deve ser
 * restringido por rede/ingress em produção (ver docs/observability.md).
 */
@ApiExcludeController()
@Controller({ path: 'metrics', version: VERSION_NEUTRAL })
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async scrape(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.scrape());
  }
}
