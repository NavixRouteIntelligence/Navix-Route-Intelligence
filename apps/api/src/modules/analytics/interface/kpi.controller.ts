import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetKpiSummaryUseCase } from '../application/get-kpi-summary.use-case';
import { RebuildKpisUseCase } from '../application/rebuild-kpis.use-case';
import type { KpiSummary } from '../domain/kpi';

/** KPIs da operação, servidos pelo read model (ADR-0092). */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller({ path: 'kpis', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(
    private readonly summary: GetKpiSummaryUseCase,
    private readonly rebuild: RebuildKpisUseCase,
  ) {}

  @Get('summary')
  @Roles('admin', 'dispatcher', 'fleet_manager')
  @ApiOperation({ summary: 'KPIs do período a partir do read model diário' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query('windowDays', new DefaultValuePipe(30), ParseIntPipe) windowDays: number,
  ): Promise<{ data: KpiSummary }> {
    const janela = Math.min(Math.max(windowDays, 1), 365);
    return { data: await this.summary.execute(user.tenantId, janela) };
  }

  /**
   * Reconstrói o histórico do read model.
   *
   * Necessário para quem já operava antes dele existir — a projeção por evento
   * só cobre o que acontece daqui para a frente — e depois de qualquer correção
   * na projeção. Restrito a `admin`: é uma operação de manutenção.
   */
  @Post('rebuild')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recalcula o read model dos últimos N dias' })
  async rebuildHistory(
    @CurrentUser() user: AuthenticatedUser,
    @Body('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<{ data: { rebuiltDays: number } }> {
    return { data: { rebuiltDays: await this.rebuild.backfill(user.tenantId, days) } };
  }
}
