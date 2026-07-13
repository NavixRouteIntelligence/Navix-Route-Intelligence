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
  OptimizationJob,
  OptimizationJobAccepted,
  ResourceResponse,
  RoutePlan as RoutePlanView,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { buildCollection } from '../../../shared/kernel/pagination';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Idempotent } from '../../../shared/idempotency/idempotency.decorator';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { EnqueueOptimizationUseCase } from '../application/enqueue-optimization.use-case';
import { GetOptimizationJobUseCase } from '../application/get-optimization-job.use-case';
import { GetRoutePlanUseCase } from '../application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../application/list-route-plans.use-case';
import { ListRoutePlansQueryDto } from './dto/list-query.dto';
import { OptimizeRouteDto } from './dto/optimize-route.dto';

const BASE_PATH = '/api/v1/route-plans';

@ApiTags('route-optimizer')
@ApiBearerAuth()
@Controller({ path: 'route-plans', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class OptimizerController {
  constructor(
    private readonly enqueue: EnqueueOptimizationUseCase,
    private readonly getJob: GetOptimizationJobUseCase,
    private readonly getPlan: GetRoutePlanUseCase,
    private readonly listPlans: ListRoutePlansUseCase,
  ) {}

  @Post()
  @Roles('admin', 'dispatcher')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @ApiOperation({ summary: 'Enfileira a otimização de uma rota (assíncrono) → 202 + jobId' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OptimizeRouteDto,
  ): Promise<ResourceResponse<OptimizationJobAccepted>> {
    const data = await this.enqueue.execute({
      ...dto,
      tenantId: user.tenantId,
      actorId: user.id,
    });
    return { data };
  }

  /**
   * Otimização com escopo de motorista: mesmo motor das Empresas, restrito ao
   * papel `driver`. O motorista envia as próprias entregas ativas (a RLS garante
   * o isolamento por tenant). Endpoint aditivo — não altera o fluxo de Empresa.
   */
  @Post('mine')
  @Roles('driver')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @ApiOperation({ summary: 'Motorista enfileira a otimização da própria rota → 202 + jobId' })
  async optimizeMine(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: OptimizeRouteDto,
  ): Promise<ResourceResponse<OptimizationJobAccepted>> {
    const data = await this.enqueue.execute({
      ...dto,
      tenantId: user.tenantId,
      actorId: user.id,
    });
    return { data };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Consulta o status de um job de otimização (polling)' })
  async job(
    @CurrentUser() user: AuthenticatedUser,
    @Param('jobId', ParseUUIDPipe) jobId: string,
  ): Promise<ResourceResponse<OptimizationJob>> {
    const data = await this.getJob.execute(user.tenantId, jobId);
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'Lista os Route Plans (histórico)' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRoutePlansQueryDto,
  ): Promise<CollectionResponse<RoutePlanView>> {
    const result = await this.listPlans.execute(user.tenantId, query.page, query.pageSize);
    return buildCollection(result.items, result.total, result.page, BASE_PATH);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um Route Plan por ID' })
  async getOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResourceResponse<RoutePlanView>> {
    const data = await this.getPlan.execute(user.tenantId, id);
    return { data };
  }
}
