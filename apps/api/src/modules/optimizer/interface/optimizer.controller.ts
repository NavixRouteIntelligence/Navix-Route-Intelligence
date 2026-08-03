import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
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
import { GetActiveRoutePlanUseCase } from '../application/get-active-route-plan.use-case';
import { GetOptimizationJobUseCase } from '../application/get-optimization-job.use-case';
import { GetRoutePlanUseCase } from '../application/get-route-plan.use-case';
import { ListRoutePlansUseCase } from '../application/list-route-plans.use-case';
import {
  DRIVER_ROSTER_LINK,
  type DriverRosterLinkPort,
} from '../application/ports/driver-roster-link.port';
import { ReoptimizeActiveUseCase } from '../application/reoptimize-active.use-case';
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
    private readonly activePlan: GetActiveRoutePlanUseCase,
    @Inject(DRIVER_ROSTER_LINK) private readonly roster: DriverRosterLinkPort,
    private readonly getJob: GetOptimizationJobUseCase,
    private readonly getPlan: GetRoutePlanUseCase,
    private readonly listPlans: ListRoutePlansUseCase,
    private readonly reoptimizeActive: ReoptimizeActiveUseCase,
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
    // A ficha vem do login autenticado (ADR-0086/0098), nunca do corpo: é o que
    // impede alguém de carimbar a própria otimização com o motorista de outro.
    const driverId = await this.roster.driverIdForUser(user.tenantId, user.id);
    const data = await this.enqueue.execute({
      ...dto,
      tenantId: user.tenantId,
      actorId: user.id,
      driverId,
      // Só este caminho carrega `ownership` (ADR-0099): o motorista só otimiza
      // as próprias entregas. O `POST /route-plans` do despacho segue livre —
      // roteirizar a frota inteira é justamente o trabalho de quem despacha.
      ownership: { driverId },
    });
    return { data };
  }

  /**
   * Rota vigente do próprio motorista (ADR-0098).
   *
   * Existe porque a regra "a mais recente do tenant, `pageSize=1`" vivia
   * duplicada no app e no web — e numa frota devolvia a rota de outra pessoa.
   * Não há parâmetro de motorista: quem pergunta é quem recebe.
   */
  @Get('mine/active')
  @Roles('driver')
  @ApiOperation({ summary: 'Rota vigente do motorista autenticado no dia operacional' })
  async mineActive(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<RoutePlanView | null>> {
    const data = await this.activePlan.execute(user.tenantId, user.id);
    return { data };
  }

  @Post('reoptimize')
  @Roles('admin', 'dispatcher')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @ApiOperation({
    summary:
      'Reotimiza as entregas ativas do tenant (trânsito/evento externo) → 202 + jobId (ou data: null se < 2 ativas)',
  })
  async reoptimize(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ResourceResponse<OptimizationJobAccepted | null>> {
    const data = await this.reoptimizeActive.execute({
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
