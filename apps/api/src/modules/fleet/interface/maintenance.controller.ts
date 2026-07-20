import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectionResponse,
  MaintenanceRecord as MaintenanceView,
  MaintenanceReminder,
  ResourceResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { CreateMaintenanceUseCase } from '../application/maintenance/create-maintenance.use-case';
import { DeleteMaintenanceUseCase } from '../application/maintenance/delete-maintenance.use-case';
import { GetMaintenanceRemindersUseCase } from '../application/maintenance/get-maintenance-reminders.use-case';
import { ListMaintenanceUseCase } from '../application/maintenance/list-maintenance.use-case';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto';

const BASE_PATH = '/api/v1/fleet/vehicles';

/**
 * Manutenção do veículo (FASE 3, V1). Aninhado ao veículo. O motorista autônomo
 * gere a própria manutenção → papéis `driver`, `admin`, `fleet_manager`. RLS por
 * tenant garante o isolamento; os use cases validam que o veículo é do tenant.
 */
@Controller({ path: 'fleet/vehicles/:vehicleId/maintenance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class MaintenanceController {
  constructor(
    private readonly createMaintenance: CreateMaintenanceUseCase,
    private readonly listMaintenance: ListMaintenanceUseCase,
    private readonly deleteMaintenance: DeleteMaintenanceUseCase,
    private readonly getReminders: GetMaintenanceRemindersUseCase,
  ) {}

  @Post()
  @Roles('driver', 'admin', 'fleet_manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() dto: CreateMaintenanceDto,
  ): Promise<ResourceResponse<MaintenanceView>> {
    const data = await this.createMaintenance.execute({ ...dto, tenantId: user.tenantId, vehicleId });
    return { data };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<CollectionResponse<MaintenanceView>> {
    const items = await this.listMaintenance.execute(user.tenantId, vehicleId);
    return buildCollection(
      items,
      items.length,
      { page: 1, pageSize: Math.max(items.length, 1) },
      `${BASE_PATH}/${vehicleId}/maintenance`,
    );
  }

  /** Lembretes de vencimento (por data e/ou km) — FASE 3, V2. */
  @Get('reminders')
  async reminders(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
  ): Promise<ResourceResponse<MaintenanceReminder[]>> {
    const data = await this.getReminders.execute(user.tenantId, vehicleId);
    return { data };
  }

  @Delete(':id')
  @Roles('driver', 'admin', 'fleet_manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('vehicleId', ParseUUIDPipe) _vehicleId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteMaintenance.execute(user.tenantId, id);
  }
}
