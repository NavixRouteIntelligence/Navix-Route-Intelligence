import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';

import { RedisHealthIndicator } from './redis.health';

/**
 * Endpoints de saúde para readiness/liveness (ver docs/architecture.md §10).
 * Público (não exige autenticação).
 *
 * - `live`  — o processo está de pé (liveness; não toca dependências).
 * - `ready` — apto a receber tráfego: Postgres é dependência **dura** (falha →
 *   503); Redis é reportado mas **não** derruba a prontidão (é degradável).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
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
    ]);
  }
}
