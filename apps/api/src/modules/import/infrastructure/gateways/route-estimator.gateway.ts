import { Inject, Injectable } from '@nestjs/common';

import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../../optimizer/application/optimizer.service';
import type {
  EstimateStop,
  RouteEstimate,
  RouteEstimatorPort,
} from '../../domain/ports/route-estimator.port';

/** Adaptador anti-corrupção: estima/otimiza via API pública do Optimizer. */
@Injectable()
export class RouteEstimatorGateway implements RouteEstimatorPort {
  constructor(@Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort) {}

  estimate(stops: EstimateStop[]): Promise<RouteEstimate> {
    return this.optimizer.estimate(stops);
  }

  optimize(tenantId: string, actorId: string, deliveryIds: string[]): Promise<string> {
    return this.optimizer.optimizeDeliveries(tenantId, actorId, deliveryIds);
  }
}
