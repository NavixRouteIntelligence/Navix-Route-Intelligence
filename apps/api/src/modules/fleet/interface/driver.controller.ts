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
  Driver as DriverView,
  ResourceResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { CreateDriverUseCase } from '../application/drivers/create-driver.use-case';
import { DeleteDriverUseCase } from '../application/drivers/delete-driver.use-case';
import { GetDriverUseCase } from '../application/drivers/get-driver.use-case';
import { ListDriversUseCase } from '../application/drivers/list-drivers.use-case';
import { UpdateDriverUseCase } from '../application/drivers/update-driver.use-case';
import { CreateDriverDto } from './dto/create-driver.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

const BASE_PATH = '/api/v1/fleet/drivers';

/** Endpoints de motoristas. Mesmas regras de auth/RBAC dos veículos. */
@Controller({ path: 'fleet/drivers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverController {
  constructor(
    private readonly createDriver: CreateDriverUseCase,
    private readonly getDriver: GetDriverUseCase,
    private readonly listDrivers: ListDriversUseCase,
    private readonly updateDriver: UpdateDriverUseCase,
    private readonly deleteDriver: DeleteDriverUseCase,
  ) {}

  @Post()
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDriverDto,
  ): Promise<ResourceResponse<DriverView>> {
    const data = await this.createDriver.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<CollectionResponse<DriverView>> {
    const result = await this.listDrivers.execute(user.tenantId, query.page, query.pageSize);
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':id')
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<DriverView>> {
    const data = await this.getDriver.execute(user.tenantId, id);
    return { data };
  }

  @Patch(':id')
  @Roles('admin', 'fleet_manager')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDriverDto,
  ): Promise<ResourceResponse<DriverView>> {
    const data = await this.updateDriver.execute({ ...dto, tenantId: user.tenantId, id });
    return { data };
  }

  @Delete(':id')
  @Roles('admin', 'fleet_manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteDriver.execute(user.tenantId, id);
  }
}
