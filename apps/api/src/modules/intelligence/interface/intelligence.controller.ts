import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  LoadPlanView,
  ResourceResponse,
  RouteIntelligenceReport,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ForecastRouteUseCase } from '../application/forecast-route.use-case';
import { PlanLoadUseCase } from '../application/plan-load.use-case';
import { LoadPlanDto } from './dto/load-plan.dto';
import { RouteForecastDto } from './dto/route-forecast.dto';

/**
 * Navix Intelligence (ADR-0025). Endpoint de **previsão de rota**: cronograma
 * (ETA por parada + conclusão), atrasos, combustível, melhor horário de saída e
 * contexto de trânsito. Disponível a qualquer usuário autenticado do tenant.
 */
@ApiTags('intelligence')
@ApiBearerAuth()
@Controller({ path: 'intelligence', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntelligenceController {
  constructor(
    private readonly forecast: ForecastRouteUseCase,
    private readonly loadPlan: PlanLoadUseCase,
  ) {}

  @Post('route-forecast')
  @ApiOperation({
    summary: 'Previsão de rota: cronograma/ETA, atrasos, combustível e melhor horário de saída',
  })
  async routeForecast(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RouteForecastDto,
  ): Promise<ResourceResponse<RouteIntelligenceReport>> {
    const data = await this.forecast.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }

  @Post('load-plan')
  @ApiOperation({
    summary: 'Organização otimizada da carga: sequência LIFO, zonas de estiva e ocupação',
  })
  loadPlanning(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LoadPlanDto,
  ): ResourceResponse<LoadPlanView> {
    const data = this.loadPlan.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }
}
