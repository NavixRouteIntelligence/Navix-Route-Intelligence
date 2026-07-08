import { Inject, Injectable } from '@nestjs/common';
import type { DriverPositionView, PositionHistoryResponse } from '@navix/contracts';

import {
  POSITION_REPOSITORY,
  type PositionRepositoryPort,
} from '../domain/ports/position-repository.port';
import { toPositionView } from './position.mapper';

const DEFAULT_HISTORY_LIMIT = 200;

/** Consultas de posição: self (motorista) e frota (empresa). */
@Injectable()
export class QueryPositionsUseCase {
  constructor(
    @Inject(POSITION_REPOSITORY) private readonly positions: PositionRepositoryPort,
  ) {}

  /** Última posição de um motorista (usado pelo próprio ou pela empresa). */
  async latestForDriver(tenantId: string, driverId: string): Promise<DriverPositionView | null> {
    const position = await this.positions.findLatestForDriver(tenantId, driverId);
    return position ? toPositionView(position) : null;
  }

  /** Última posição de cada motorista do tenant (visão de frota — empresa). */
  async fleetLatest(tenantId: string): Promise<DriverPositionView[]> {
    const now = new Date();
    const positions = await this.positions.findLatestPerDriver(tenantId);
    return positions.map((p) => toPositionView(p, now));
  }

  /** Histórico de posições de um motorista. */
  async history(
    tenantId: string,
    driverId: string,
    limit = DEFAULT_HISTORY_LIMIT,
  ): Promise<PositionHistoryResponse> {
    const now = new Date();
    const points = await this.positions.findHistory(tenantId, driverId, limit);
    return { driverId, points: points.map((p) => toPositionView(p, now)) };
  }
}
