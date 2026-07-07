import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DeliveryModule } from '../delivery/delivery.module';
import { GetRoutePlanUseCase } from './application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from './application/list-route-plans.use-case';
import { OptimizeRouteUseCase } from './application/optimize-route.use-case';
import { OPTIMIZER_SERVICE, OptimizerService } from './application/optimizer.service';
import { StrategyRegistry } from './application/strategy-registry';
import { DELIVERY_GATEWAY } from './application/ports/delivery-gateway.port';
import { DISTANCE_PROVIDER } from './domain/ports/distance-provider.port';
import { OPTIMIZATION_STRATEGIES } from './domain/ports/route-optimization-strategy.port';
import { ROUTE_PLAN_REPOSITORY } from './domain/ports/route-plan-repository.port';
import { HaversineDistanceProvider } from './infrastructure/distance/haversine-distance.provider';
import { DeliveryGateway } from './infrastructure/gateways/delivery.gateway';
import { RoutePlanOrmEntity } from './infrastructure/persistence/route-plan.orm-entity';
import { RoutePlanRepository } from './infrastructure/persistence/route-plan.repository';
import { NearestNeighbor2OptStrategy } from './infrastructure/strategies/nearest-neighbor-2opt.strategy';
import { OptimizerController } from './interface/optimizer.controller';

/**
 * Módulo Optimizer (Route Optimizer). As estratégias são registradas como um
 * array (multi-provider) — novas estratégias entram aqui sem tocar no resto.
 */
@Module({
  imports: [TypeOrmModule.forFeature([RoutePlanOrmEntity]), DeliveryModule],
  controllers: [OptimizerController],
  providers: [
    OptimizeRouteUseCase,
    GetRoutePlanUseCase,
    ListRoutePlansUseCase,
    StrategyRegistry,
    NearestNeighbor2OptStrategy,
    {
      provide: OPTIMIZATION_STRATEGIES,
      useFactory: (nn: NearestNeighbor2OptStrategy) => [nn],
      inject: [NearestNeighbor2OptStrategy],
    },
    { provide: DISTANCE_PROVIDER, useClass: HaversineDistanceProvider },
    { provide: ROUTE_PLAN_REPOSITORY, useClass: RoutePlanRepository },
    { provide: DELIVERY_GATEWAY, useClass: DeliveryGateway },
    { provide: OPTIMIZER_SERVICE, useClass: OptimizerService },
  ],
  exports: [OPTIMIZER_SERVICE],
})
export class OptimizerModule {}
