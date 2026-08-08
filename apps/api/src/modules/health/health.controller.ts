import { Controller, Get, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { HealthCheckFilter } from './health-check.filter';
import { QueueHealthIndicator } from './queue.health';
import { RedisHealthIndicator } from './redis.health';

/**
 * Endpoints de saúde para readiness/liveness (ver docs/architecture.md §10).
 * Público (não exige autenticação).
 *
 * - `live`  — o processo está de pé (liveness; não toca dependências).
 * - `ready` — apto a receber tráfego: Postgres é dependência **dura** (falha →
 *   503); Redis é reportado mas **não** derruba a prontidão (é degradável); a
 *   **fila de otimização** é dura quando o driver é `bullmq` (ADR-0114) — o
 *   mesmo Redis, papéis diferentes: cache fora vira miss, fila fora significa
 *   que toda otimização falha.
 */
@ApiTags('health')
// Sem isto, um `/ready` em vermelho responde "Service Unavailable Exception" e
// esconde qual dependência caiu (ADR-0114).
@UseFilters(HealthCheckFilter)
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly queue: QueueHealthIndicator,
  ) {}

  @Get('live')
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.redis.check('redis'),
      () => this.queue.check('optimizer-queue'),
    ]);
  }
}
