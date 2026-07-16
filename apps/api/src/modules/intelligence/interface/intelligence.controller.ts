import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  CollectiveInsightView,
  LoadPlanView,
  RecordObservationResult,
  ResourceResponse,
  RouteIntelligenceReport,
  VoiceCommandView,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { ForecastRouteUseCase } from '../application/forecast-route.use-case';
import { GetCollectiveInsightUseCase } from '../application/get-collective-insight.use-case';
import { InterpretVoiceCommandUseCase } from '../application/interpret-voice-command.use-case';
import { PlanLoadUseCase } from '../application/plan-load.use-case';
import { RecordObservationUseCase } from '../application/record-observation.use-case';
import { InsightQueryDto } from './dto/insight.query.dto';
import { LoadPlanDto } from './dto/load-plan.dto';
import { RecordObservationDto } from './dto/record-observation.dto';
import { RouteForecastDto } from './dto/route-forecast.dto';
import { VoiceCommandDto } from './dto/voice-command.dto';

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
    private readonly recordObservation: RecordObservationUseCase,
    private readonly collectiveInsight: GetCollectiveInsightUseCase,
    private readonly voiceCommand: InterpretVoiceCommandUseCase,
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

  @Post('observations')
  @ApiOperation({
    summary: 'Inteligência coletiva: registra uma observação de campo do motorista',
  })
  async observe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RecordObservationDto,
  ): Promise<ResourceResponse<RecordObservationResult>> {
    const data = await this.recordObservation.execute({
      ...dto,
      tenantId: user.tenantId,
      driverId: user.id,
    });
    return { data };
  }

  @Get('insights')
  @ApiOperation({
    summary: 'Inteligência coletiva: insight agregado da comunidade por localização',
  })
  async insights(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: InsightQueryDto,
  ): Promise<ResourceResponse<CollectiveInsightView>> {
    const data = await this.collectiveInsight.execute({
      tenantId: user.tenantId,
      latitude: query.latitude,
      longitude: query.longitude,
    });
    return { data };
  }

  @Post('voice-command')
  @ApiOperation({
    summary: 'Assistente por voz: classifica a intenção de um comando falado',
  })
  voice(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VoiceCommandDto,
  ): ResourceResponse<VoiceCommandView> {
    const data = this.voiceCommand.execute({ ...dto, tenantId: user.tenantId });
    return { data };
  }
}
