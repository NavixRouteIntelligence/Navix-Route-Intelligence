import { Inject, Injectable } from '@nestjs/common';

import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../../optimizer/application/optimizer.service';
import { QueryPositionsUseCase } from '../../../tracking/application/query-positions.use-case';
import type {
  RouteEtaGatewayPort,
  VehicleLocationGatewayPort,
  VehiclePositionSnapshot,
} from '../../application/ports/public-tracking-sources.port';

/**
 * Adaptadores anti-corrupção do rastreamento público (ADR-0082). Únicas pontes
 * do Delivery para o Optimizer e o Tracking — mesmo padrão do `FleetGateway`:
 * traduzem as portas do Delivery para as APIs públicas dos outros módulos.
 */

@Injectable()
export class RouteEtaGateway implements RouteEtaGatewayPort {
  constructor(@Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort) {}

  etaForDelivery(tenantId: string, deliveryId: string): Promise<Date | null> {
    return this.optimizer.etaForDelivery(tenantId, deliveryId);
  }
}

@Injectable()
export class VehicleLocationGateway implements VehicleLocationGatewayPort {
  constructor(private readonly positions: QueryPositionsUseCase) {}

  async latestForDriver(
    tenantId: string,
    driverId: string,
  ): Promise<VehiclePositionSnapshot | null> {
    const view = await this.positions.latestForDriver(tenantId, driverId);
    if (!view) return null;
    // Reduz a view interna ao mínimo público: sem driverId, sem velocidade,
    // sem rumo, sem status de tracking.
    return {
      latitude: view.latitude,
      longitude: view.longitude,
      recordedAt: new Date(view.recordedAt),
    };
  }
}
