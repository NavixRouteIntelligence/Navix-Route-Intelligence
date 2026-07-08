import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { QueryPositionsUseCase } from './application/query-positions.use-case';
import { UpdatePositionUseCase } from './application/update-position.use-case';
import { POSITION_REPOSITORY } from './domain/ports/position-repository.port';
import { DriverPositionOrmEntity } from './infrastructure/persistence/driver-position.orm-entity';
import { PositionRepository } from './infrastructure/persistence/position.repository';
import { TrackingController } from './interface/tracking.controller';

/**
 * Módulo Tracking (MVP). Ingestão e consulta de posições de motoristas, com
 * isolamento por tenant (RLS) e RBAC. Preparado para evoluir com ETA, otimização
 * dinâmica e notificações, e para transporte em tempo real (WebSocket/SSE).
 */
@Module({
  imports: [TypeOrmModule.forFeature([DriverPositionOrmEntity])],
  controllers: [TrackingController],
  providers: [
    UpdatePositionUseCase,
    QueryPositionsUseCase,
    { provide: POSITION_REPOSITORY, useClass: PositionRepository },
  ],
})
export class TrackingModule {}
