import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CollectionResponse,
  PodSummary,
  ProofOfDeliveryView,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Idempotent } from '../../../shared/idempotency/idempotency.decorator';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { QueryPodUseCase } from '../application/query-pod.use-case';
import { SubmitPodUseCase } from '../application/submit-pod.use-case';
import { ListQueryDto } from './dto/list-query.dto';
import { CreatePodDto } from './dto/create-pod.dto';

const BASE_PATH = '/api/v1/pod';

/**
 * Proof of Delivery. Registro pelo motorista (ou admin/dispatcher); consultas
 * abertas a qualquer autenticado (escopadas por tenant via RLS).
 */
@ApiTags('pod')
@ApiBearerAuth()
@Controller({ path: 'pod', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class PodController {
  constructor(
    private readonly submit: SubmitPodUseCase,
    private readonly queries: QueryPodUseCase,
  ) {}

  @Post()
  @Roles('driver', 'admin', 'dispatcher')
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  @ApiOperation({ summary: 'Registra o comprovante de entrega e aplica o desfecho' })
  submitHandler(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePodDto,
  ): Promise<ProofOfDeliveryView> {
    return this.submit.execute({ ...dto, tenantId: user.tenantId, driverId: user.id });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumo de comprovantes por status (Dashboard)' })
  summaryHandler(@CurrentUser() user: AuthenticatedUser): Promise<PodSummary> {
    return this.queries.summary(user.tenantId);
  }

  @Get()
  @ApiOperation({ summary: 'Histórico de comprovantes (paginado)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
  ): Promise<CollectionResponse<ProofOfDeliveryView>> {
    const result = await this.queries.list(user.tenantId, query.page, query.pageSize);
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':deliveryId')
  @ApiOperation({ summary: 'Comprovante de uma entrega' })
  async byDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('deliveryId', ParseUUIDPipe) deliveryId: string,
  ): Promise<{ data: ProofOfDeliveryView | null }> {
    const data = await this.queries.byDelivery(user.tenantId, deliveryId);
    return { data };
  }
}
