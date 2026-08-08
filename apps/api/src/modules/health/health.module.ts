import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { OptimizerModule } from '../optimizer/optimizer.module';
import { HealthController } from './health.controller';
import { QueueHealthIndicator } from './queue.health';
import { RedisHealthIndicator } from './redis.health';

@Module({
  // `OptimizerModule` entra pelos **ports** de saúde da fila (ADR-0114), não
  // pelos casos de uso: o health não sabe otimizar rota, só perguntar se a
  // fila responde.
  imports: [TerminusModule, OptimizerModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, QueueHealthIndicator],
})
export class HealthModule {}
