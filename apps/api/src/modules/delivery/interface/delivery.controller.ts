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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CollectionResponse,
  Delivery as DeliveryView,
  ResourceResponse,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection, normalizePage } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ChangeDeliveryStatusUseCase } from '../application/change-delivery-status.use-case';
import { CreateDeliveryUseCase } from '../application/create-delivery.use-case';
import { DeleteDeliveryUseCase } from '../application/delete-delivery.use-case';
import { GetDeliveryUseCase } from '../application/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../application/list-deliveries.use-case';
import { UpdateDeliveryUseCase } from '../application/update-delivery.use-case';
import type { DeliverySort } from '../application/queries/list-deliveries.query';
import { ALLOWED_SORT_FIELDS } from '../application/queries/list-deliveries.query';
import { ChangeStatusDto } from './dto/change-status.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { ListDeliveriesQueryDto } from './dto/list-deliveries.query.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';

const BASE_PATH = '/api/v1/deliveries';

@ApiTags('deliveries')
@ApiBearerAuth()
@Controller({ path: 'deliveries', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeliveryController {
  constructor(
    private readonly createDelivery: CreateDeliveryUseCase,
    private readonly getDelivery: GetDeliveryUseCase,
    private readonly listDeliveries: ListDeliveriesUseCase,
    private readonly updateDelivery: UpdateDeliveryUseCase,
    private readonly changeStatus: ChangeDeliveryStatusUseCase,
    private readonly deleteDelivery: DeleteDeliveryUseCase,
  ) {}

  @Post()
  @Roles('admin', 'dispatcher')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cadastra uma entrega' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDeliveryDto,
  ): Promise<ResourceResponse<DeliveryView>> {
    const data = await this.createDelivery.execute({
      ...dto,
      tenantId: user.tenantId,
      actorId: user.id,
    });
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'Lista entregas (filtros, ordenação e paginação)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListDeliveriesQueryDto,
  ): Promise<CollectionResponse<DeliveryView>> {
    const page = normalizePage(query.page, query.pageSize);
    const result = await this.listDeliveries.execute(user.tenantId, {
      page,
      filters: {
        status: query.status,
        priority: query.priority,
        driverId: query.driverId,
        vehicleId: query.vehicleId,
        routeId: query.routeId,
        windowFrom: query.windowFrom ? new Date(query.windowFrom) : undefined,
        windowTo: query.windowTo ? new Date(query.windowTo) : undefined,
      },
      sort: this.parseSort(query.sort),
    });
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta uma entrega por ID' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<DeliveryView>> {
    const data = await this.getDelivery.execute(user.tenantId, id);
    return { data };
  }

  @Patch(':id')
  @Roles('admin', 'dispatcher')
  @ApiOperation({ summary: 'Atualiza dados de uma entrega' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ): Promise<ResourceResponse<DeliveryView>> {
    const data = await this.updateDelivery.execute({
      ...dto,
      tenantId: user.tenantId,
      id,
      actorId: user.id,
    });
    return { data };
  }

  @Patch(':id/status')
  @Roles('admin', 'dispatcher')
  @ApiOperation({ summary: 'Altera o status (respeita a máquina de estados)' })
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<ResourceResponse<DeliveryView>> {
    const data = await this.changeStatus.execute({
      tenantId: user.tenantId,
      id,
      actorId: user.id,
      status: dto.status,
    });
    return { data };
  }

  @Delete(':id')
  @Roles('admin', 'dispatcher')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclusão lógica (soft delete)' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.deleteDelivery.execute(user.tenantId, id, user.id);
  }

  /** Converte `sort=-createdAt,priority` em uma lista tipada e segura. */
  private parseSort(raw?: string): DeliverySort[] {
    if (!raw) return [];
    const result: DeliverySort[] = [];
    for (const token of raw.split(',')) {
      const trimmed = token.trim();
      if (!trimmed) continue;
      const direction = trimmed.startsWith('-') ? 'DESC' : 'ASC';
      const field = trimmed.replace(/^[-+]/, '');
      if ((ALLOWED_SORT_FIELDS as readonly string[]).includes(field)) {
        result.push({ field: field as DeliverySort['field'], direction });
      }
    }
    return result;
  }
}
