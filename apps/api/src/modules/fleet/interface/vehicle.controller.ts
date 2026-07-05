import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  AuthenticatedUser,
  CollectionResponse,
  ResourceResponse,
  Vehicle as VehicleView,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { CreateVehicleUseCase } from '../application/vehicles/create-vehicle.use-case';
import { DeleteVehicleUseCase } from '../application/vehicles/delete-vehicle.use-case';
import { GetVehicleUseCase } from '../application/vehicles/get-vehicle.use-case';
import { ListVehiclesUseCase } from '../application/vehicles/list-vehicles.use-case';
import { UpdateVehicleUseCase } from '../application/vehicles/update-vehicle.use-case';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

const BASE_PATH = '/api/v1/fleet/vehicles';

/**
 * Endpoints de veículos (ver docs/api.md). Todas as rotas exigem autenticação;
 * mutações exigem papel 'admin' ou 'fleet_manager' (RBAC — docs/security.md §3).
 */
@Controller({ path: 'fleet/vehicles', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class VehicleController {
  constructor(
    private readonly createVehicle: CreateVehicleUseCase,
    private readonly getVehicle: GetVehicleUseCase,
    private readonly listVehicles: ListVehiclesUseCase,
    private readonly updateVehicle: UpdateVehicleUseCase,
    private readonly deleteVehicle: DeleteVehicleUseCase,
  ) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateVehicleDto,
  ): Promise<ResourceResponse<VehicleView>> {
    const data = await this.createVehicle.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<CollectionResponse<VehicleView>> {
    const result = await this.listVehicles.execute(user.tenantId, query.page, query.pageSize);
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<VehicleView>> {
    const data = await this.getVehicle.execute(user.tenantId, id);
    return { data };
  }

  @Patch(':id')
  @Roles('admin', 'fleet_manager')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVehicleDto,
  ): Promise<ResourceResponse<VehicleView>> {
    const data = await this.updateVehicle.execute({ ...dto, tenantId: user.tenantId, id });
    return { data };
  }

  @Delete(':id')
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteVehicle.execute(user.tenantId, id);
  }
}
