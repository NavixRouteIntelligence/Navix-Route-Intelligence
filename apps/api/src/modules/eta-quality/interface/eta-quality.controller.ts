import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetEtaQualityUseCase } from '../application/get-eta-quality.use-case';
import type { EtaQualitySummary } from '../domain/eta-observation';

/**
 * Qualidade do ETA (ADR-0087) — quanto o prometido erra do realizado.
 *
 * Restrito aos perfis administrativos: é uma medida da operação inteira, e não
 * um dado da rota de um motorista.
 */
@ApiTags('intelligence')
@ApiBearerAuth()
@Controller({ path: 'eta/quality', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class EtaQualityController {
  constructor(private readonly quality: GetEtaQualityUseCase) {}

  @Get()
  @Roles('admin', 'dispatcher', 'fleet_manager')
  @ApiOperation({ summary: 'Erro médio do ETA (MAE), viés e p90 no período' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query('windowDays', new DefaultValuePipe(30), ParseIntPipe) windowDays: number,
  ): Promise<{ data: EtaQualitySummary }> {
    const janela = Math.min(Math.max(windowDays, 1), 365);
    return { data: await this.quality.execute(user.tenantId, janela) };
  }
}
