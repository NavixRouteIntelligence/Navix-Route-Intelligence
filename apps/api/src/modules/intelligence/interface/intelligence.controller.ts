import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, ResourceResponse, RouteIntelligenceReport } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ForecastRouteUseCase } from '../application/forecast-route.use-case';
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
  constructor(private readonly forecast: ForecastRouteUseCase) {}

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
}
