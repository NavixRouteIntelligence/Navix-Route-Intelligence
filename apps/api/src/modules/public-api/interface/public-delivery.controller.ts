import type {
  AuthenticatedUser,
  CollectionResponse,
  Delivery as DeliveryView,
  ResourceResponse,
} from '@navix/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection, normalizePage } from '../../../shared/kernel/pagination';
import { ChangeDeliveryStatusUseCase } from '../../delivery/application/change-delivery-status.use-case';
import { CreateDeliveryUseCase } from '../../delivery/application/create-delivery.use-case';
import { GetDeliveryUseCase } from '../../delivery/application/get-delivery.use-case';
import { ListDeliveriesUseCase } from '../../delivery/application/list-deliveries.use-case';
import {
  ALLOWED_SORT_FIELDS,
  type DeliverySort,
} from '../../delivery/application/queries/list-deliveries.query';
import { UpdateDeliveryUseCase } from '../../delivery/application/update-delivery.use-case';
import { ChangeStatusDto } from '../../delivery/interface/dto/change-status.dto';
import { CreateDeliveryDto } from '../../delivery/interface/dto/create-delivery.dto';
import { ListDeliveriesQueryDto } from '../../delivery/interface/dto/list-deliveries.query.dto';
import { UpdateDeliveryDto } from '../../delivery/interface/dto/update-delivery.dto';
import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../optimizer/application/optimizer.service';
import { QueryPodUseCase } from '../../pod/application/query-pod.use-case';

import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { ApiScopes } from './api-scopes.decorator';

const BASE_PATH = '/api/v1/public/deliveries';

@ApiTags('public-api')
@ApiSecurity('api-key')
@Controller({ path: 'public', version: '1' })
@UseGuards(ApiKeyAuthGuard)
export class PublicDeliveryController {
  constructor(
    private readonly createDelivery: CreateDeliveryUseCase,
    private readonly getDelivery: GetDeliveryUseCase,
    private readonly listDeliveries: ListDeliveriesUseCase,
    private readonly updateDelivery: UpdateDeliveryUseCase,
    private readonly changeStatus: ChangeDeliveryStatusUseCase,
    private readonly pods: QueryPodUseCase,
    @Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort,
  ) {}

  @Post('deliveries')
  @ApiScopes('deliveries:write')
  @ApiOperation({ summary: 'Cria uma entrega pela API pública' })
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

  @Get('deliveries')
  @ApiScopes('deliveries:read')
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

  @Get('deliveries/:id')
  @ApiScopes('deliveries:read')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<DeliveryView>> {
    return { data: await this.getDelivery.execute(user.tenantId, id) };
  }

  @Patch('deliveries/:id')
  @ApiScopes('deliveries:write')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDeliveryDto,
  ): Promise<ResourceResponse<DeliveryView>> {
    return {
      data: await this.updateDelivery.execute({
        ...dto,
        tenantId: user.tenantId,
        actorId: user.id,
        id,
      }),
    };
  }

  @Patch('deliveries/:id/status')
  @ApiScopes('deliveries:write')
  async status(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStatusDto,
  ): Promise<ResourceResponse<DeliveryView>> {
    return {
      data: await this.changeStatus.execute({
        tenantId: user.tenantId,
        actorId: user.id,
        id,
        status: dto.status,
      }),
    };
  }

  @Get('pod/:deliveryId')
  @ApiScopes('pod:read')
  async pod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    return { data: await this.pods.byDelivery(user.tenantId, deliveryId) };
  }

  @Get('eta/:deliveryId')
  @ApiScopes('eta:read')
  async eta(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ) {
    const eta = await this.optimizer.etaForDelivery(user.tenantId, deliveryId);
    return { data: { deliveryId, estimatedArrivalAt: eta?.toISOString() ?? null } };
  }

  private parseSort(raw?: string): DeliverySort[] {
    if (!raw) return [];
    return raw.split(',').flatMap((token): DeliverySort[] => {
      const trimmed = token.trim();
      const field = trimmed.replace(/^[-+]/, '');
      if (!(ALLOWED_SORT_FIELDS as readonly string[]).includes(field)) return [];
      return [
        {
          field: field as DeliverySort['field'],
          direction: trimmed.startsWith('-') ? 'DESC' : 'ASC',
        },
      ];
    });
  }
}
