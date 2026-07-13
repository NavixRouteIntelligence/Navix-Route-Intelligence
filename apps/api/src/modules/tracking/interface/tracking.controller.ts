import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  DriverPositionView,
  PositionBatchResponse,
  PositionHistoryResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Idempotent } from '../../../shared/idempotency/idempotency.decorator';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { BatchUpdatePositionsUseCase } from '../application/batch-update-positions.use-case';
import { QueryPositionsUseCase } from '../application/query-positions.use-case';
import { UpdatePositionUseCase } from '../application/update-position.use-case';
import { PositionBatchDto } from './dto/position-batch.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

/**
 * Tracking. `me/*` são as visões do próprio motorista (Autônomo e motorista de
 * empresa). `positions/latest` e `drivers/:id/history` são a **visão de frota**,
 * hoje restrita a perfis administrativos (empresa). Para liberar a frota também
 * ao Autônomo no futuro, basta ajustar os papéis nestes dois endpoints.
 */
@ApiTags('tracking')
@ApiBearerAuth()
@Controller({ path: 'tracking', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(
    private readonly updatePosition: UpdatePositionUseCase,
    private readonly batchUpdate: BatchUpdatePositionsUseCase,
    private readonly queries: QueryPositionsUseCase,
  ) {}

  @Post('positions')
  @Roles('driver')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @ApiOperation({ summary: 'Motorista envia sua posição atual' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePositionDto,
  ): Promise<{ data: DriverPositionView }> {
    const data = await this.updatePosition.execute({
      ...dto,
      tenantId: user.tenantId,
      driverId: user.id,
    });
    return { data };
  }

  @Post('positions/batch')
  @Roles('driver')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @ApiOperation({ summary: 'Motorista envia várias posições (sincronização offline)' })
  async updateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PositionBatchDto,
  ): Promise<{ data: PositionBatchResponse }> {
    const positions = await this.batchUpdate.execute({
      positions: dto.positions,
      tenantId: user.tenantId,
      driverId: user.id,
    });
    return { data: { accepted: positions.length, positions } };
  }

  @Get('me/latest')
  @ApiOperation({ summary: 'Última posição do próprio motorista' })
  async myLatest(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DriverPositionView | null }> {
    const data = await this.queries.latestForDriver(user.tenantId, user.id);
    return { data };
  }

  @Get('me/history')
  @ApiOperation({ summary: 'Histórico de posições do próprio motorista' })
  myHistory(@CurrentUser() user: AuthenticatedUser): Promise<PositionHistoryResponse> {
    return this.queries.history(user.tenantId, user.id);
  }

  @Get('positions/latest')
  @Roles('admin', 'dispatcher', 'fleet_manager')
  @ApiOperation({ summary: 'Última posição de cada motorista da frota (empresa)' })
  async fleetLatest(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: DriverPositionView[] }> {
    const data = await this.queries.fleetLatest(user.tenantId);
    return { data };
  }

  @Get('drivers/:driverId/history')
  @Roles('admin', 'dispatcher', 'fleet_manager')
  @ApiOperation({ summary: 'Histórico de posições de um motorista (empresa)' })
  driverHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('driverId', ParseUUIDPipe) driverId: string,
  ): Promise<PositionHistoryResponse> {
    return this.queries.history(user.tenantId, driverId);
  }
}
