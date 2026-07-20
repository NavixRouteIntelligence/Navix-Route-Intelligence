import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { EnqueueOptimizationUseCase } from './application/enqueue-optimization.use-case';
import { GetOptimizationJobUseCase } from './application/get-optimization-job.use-case';
import { GetRoutePlanUseCase } from './application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from './application/list-route-plans.use-case';
import { OptimizeRouteUseCase } from './application/optimize-route.use-case';
import { OPTIMIZER_SERVICE, OptimizerService } from './application/optimizer.service';
import { ProcessOptimizationJobUseCase } from './application/process-optimization-job.use-case';
import { ReoptimizeActiveUseCase } from './application/reoptimize-active.use-case';
import { RouteSolver } from './application/route-solver';
import {
  AutoReoptimizationService,
  REOPTIMIZATION_TRIGGER,
} from './application/auto-reoptimization.service';
import { StrategyRegistry } from './application/strategy-registry';
import { DELIVERY_GATEWAY } from './application/ports/delivery-gateway.port';
import { SERVICE_TIME_HISTORY } from './application/ports/service-time-history.port';
import { COST_AUGMENTATION } from './domain/ports/cost-augmentation.port';
import { DISTANCE_PROVIDER } from './domain/ports/distance-provider.port';
import { ROUTING_PROVIDER } from './domain/ports/routing-provider.port';
import { JOB_EVENTS } from './domain/ports/job-events.port';
import { OPTIMIZATION_JOB_QUEUE } from './domain/ports/optimization-job-queue.port';
import { OPTIMIZATION_JOB_REPOSITORY } from './domain/ports/optimization-job-repository.port';
import { OPTIMIZATION_STRATEGIES } from './domain/ports/route-optimization-strategy.port';
import { ROUTE_PLAN_REPOSITORY } from './domain/ports/route-plan-repository.port';
import { AppConfigService } from '../../shared/config/app-config.service';
import { ConfigurableCostAugmentation } from './infrastructure/augmentation/configurable-cost-augmentation';
import { HaversineDistanceProvider } from './infrastructure/distance/haversine-distance.provider';
import { HaversineRoutingProvider } from './infrastructure/routing/haversine-routing.provider';
import { MapboxRoutingProvider } from './infrastructure/routing/mapbox-routing.provider';
import { RealtimeJobEvents } from './infrastructure/events/realtime-job-events';
import { DeliveryGateway } from './infrastructure/gateways/delivery.gateway';
import { IntelligenceServiceTimeHistory } from './infrastructure/history/intelligence-service-time-history';
import { OptimizationJobOrmEntity } from './infrastructure/persistence/optimization-job.orm-entity';
import { OptimizationJobRepository } from './infrastructure/persistence/optimization-job.repository';
import { RoutePlanOrmEntity } from './infrastructure/persistence/route-plan.orm-entity';
import { RoutePlanRepository } from './infrastructure/persistence/route-plan.repository';
import { OptimizerMetrics } from './infrastructure/observability/optimizer-metrics';
import { InProcessOptimizationJobQueue } from './infrastructure/queue/in-process-optimization-job.queue';
import { BullOptimizationJobQueue } from './infrastructure/queue/bull-optimization-job.queue';
import { OptimizationJobWorker } from './infrastructure/queue/optimization-job.worker';
import { TenantScopedReoptimizationTrigger } from './infrastructure/reoptimization/tenant-scoped-reoptimization.trigger';
import { ManualStrategy } from './infrastructure/strategies/manual.strategy';
import { NearestNeighbor2OptStrategy } from './infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { OrOpt2OptStrategy } from './infrastructure/strategies/or-opt-2opt.strategy';
import { OptimizerController } from './interface/optimizer.controller';

/**
 * Módulo Optimizer (Route Optimizer). As estratégias são registradas como um
 * array (multi-provider) — novas estratégias entram aqui sem tocar no resto.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([RoutePlanOrmEntity, OptimizationJobOrmEntity]),
    DeliveryModule,
    IntelligenceModule,
  ],
  controllers: [OptimizerController],
  providers: [
    OptimizeRouteUseCase,
    EnqueueOptimizationUseCase,
    ProcessOptimizationJobUseCase,
    GetOptimizationJobUseCase,
    GetRoutePlanUseCase,
    ListRoutePlansUseCase,
    ReoptimizeActiveUseCase,
    AutoReoptimizationService,
    { provide: REOPTIMIZATION_TRIGGER, useClass: TenantScopedReoptimizationTrigger },
    StrategyRegistry,
    RouteSolver,
    OptimizerMetrics,
    NearestNeighbor2OptStrategy,
    OrOpt2OptStrategy,
    ManualStrategy,
    {
      provide: OPTIMIZATION_STRATEGIES,
      useFactory: (
        nn: NearestNeighbor2OptStrategy,
        orOpt: OrOpt2OptStrategy,
        manual: ManualStrategy,
      ) => [nn, orOpt, manual],
      inject: [NearestNeighbor2OptStrategy, OrOpt2OptStrategy, ManualStrategy],
    },
    { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
    HaversineRoutingProvider,
    MapboxRoutingProvider,
    {
      // Provedor de roteamento por configuração (ADR-0027); mapbox degrada p/ Haversine.
      provide: ROUTING_PROVIDER,
      inject: [AppConfigService, HaversineRoutingProvider, MapboxRoutingProvider],
      useFactory: (
        config: AppConfigService,
        haversine: HaversineRoutingProvider,
        mapbox: MapboxRoutingProvider,
      ) => (config.maps.provider === 'mapbox' ? mapbox : haversine),
    },
    { provide: COST_AUGMENTATION, useClass: ConfigurableCostAugmentation },
    { provide: ROUTE_PLAN_REPOSITORY, useClass: RoutePlanRepository },
    { provide: OPTIMIZATION_JOB_REPOSITORY, useClass: OptimizationJobRepository },
    {
      // Fila por configuração (ADR-0007/0055): `bullmq` (durável no Redis) ou
      // `inprocess` (default). Trocar o driver não toca nos casos de uso.
      provide: OPTIMIZATION_JOB_QUEUE,
      inject: [AppConfigService, DataSource, ProcessOptimizationJobUseCase],
      useFactory: (
        config: AppConfigService,
        dataSource: DataSource,
        processor: ProcessOptimizationJobUseCase,
      ) =>
        config.optimizer.queueDriver === 'bullmq'
          ? new BullOptimizationJobQueue(config)
          : new InProcessOptimizationJobQueue(dataSource, processor),
    },
    // Worker BullMQ: instanciado sempre, mas só ativa (abre conexão/consome)
    // quando driver=bullmq e worker habilitado — via guarda no onModuleInit.
    OptimizationJobWorker,
    { provide: JOB_EVENTS, useClass: RealtimeJobEvents },
    { provide: DELIVERY_GATEWAY, useClass: DeliveryGateway },
    { provide: SERVICE_TIME_HISTORY, useClass: IntelligenceServiceTimeHistory },
    { provide: OPTIMIZER_SERVICE, useClass: OptimizerService },
  ],
  exports: [OPTIMIZER_SERVICE],
})
export class OptimizerModule {}
