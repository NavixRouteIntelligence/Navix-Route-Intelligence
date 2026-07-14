import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { EnqueueOptimizationUseCase } from './application/enqueue-optimization.use-case';
import { GetOptimizationJobUseCase } from './application/get-optimization-job.use-case';
import { GetRoutePlanUseCase } from './application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from './application/list-route-plans.use-case';
import { OptimizeRouteUseCase } from './application/optimize-route.use-case';
import { OPTIMIZER_SERVICE, OptimizerService } from './application/optimizer.service';
import { ProcessOptimizationJobUseCase } from './application/process-optimization-job.use-case';
import { StrategyRegistry } from './application/strategy-registry';
import { DELIVERY_GATEWAY } from './application/ports/delivery-gateway.port';
import { DISTANCE_PROVIDER } from './domain/ports/distance-provider.port';
import { JOB_EVENTS } from './domain/ports/job-events.port';
import { OPTIMIZATION_JOB_QUEUE } from './domain/ports/optimization-job-queue.port';
import { OPTIMIZATION_JOB_REPOSITORY } from './domain/ports/optimization-job-repository.port';
import { OPTIMIZATION_STRATEGIES } from './domain/ports/route-optimization-strategy.port';
import { ROUTE_PLAN_REPOSITORY } from './domain/ports/route-plan-repository.port';
import { HaversineDistanceProvider } from './infrastructure/distance/haversine-distance.provider';
import { RealtimeJobEvents } from './infrastructure/events/realtime-job-events';
import { DeliveryGateway } from './infrastructure/gateways/delivery.gateway';
import { OptimizationJobOrmEntity } from './infrastructure/persistence/optimization-job.orm-entity';
import { OptimizationJobRepository } from './infrastructure/persistence/optimization-job.repository';
import { RoutePlanOrmEntity } from './infrastructure/persistence/route-plan.orm-entity';
import { RoutePlanRepository } from './infrastructure/persistence/route-plan.repository';
import { OptimizerMetrics } from './infrastructure/observability/optimizer-metrics';
import { InProcessOptimizationJobQueue } from './infrastructure/queue/in-process-optimization-job.queue';
import { NearestNeighbor2OptStrategy } from './infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { OptimizerController } from './interface/optimizer.controller';

/**
 * Módulo Optimizer (Route Optimizer). As estratégias são registradas como um
 * array (multi-provider) — novas estratégias entram aqui sem tocar no resto.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RoutePlanOrmEntity, OptimizationJobOrmEntity]),
    DeliveryModule,
  ],
  controllers: [OptimizerController],
  providers: [
    OptimizeRouteUseCase,
    EnqueueOptimizationUseCase,
    ProcessOptimizationJobUseCase,
    GetOptimizationJobUseCase,
    GetRoutePlanUseCase,
    ListRoutePlansUseCase,
    StrategyRegistry,
    OptimizerMetrics,
    NearestNeighbor2OptStrategy,
    {
      provide: OPTIMIZATION_STRATEGIES,
      useFactory: (nn: NearestNeighbor2OptStrategy) => [nn],
      inject: [NearestNeighbor2OptStrategy],
    },
    { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
    { provide: ROUTE_PLAN_REPOSITORY, useClass: RoutePlanRepository },
    { provide: OPTIMIZATION_JOB_REPOSITORY, useClass: OptimizationJobRepository },
    { provide: OPTIMIZATION_JOB_QUEUE, useClass: InProcessOptimizationJobQueue },
    { provide: JOB_EVENTS, useClass: RealtimeJobEvents },
    { provide: DELIVERY_GATEWAY, useClass: DeliveryGateway },
    { provide: OPTIMIZER_SERVICE, useClass: OptimizerService },
  ],
  exports: [OPTIMIZER_SERVICE],
})
export class OptimizerModule {}
