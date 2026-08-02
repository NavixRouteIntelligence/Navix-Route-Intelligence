import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, DriverPerformanceView } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetDriverPerformanceUseCase } from '../application/get-driver-performance.use-case';

/**
 * Desempenho do próprio motorista (ADR-0097).
 *
 * `me`, e não `/drivers/:id`: **não existe** rota para consultar o desempenho de
 * outro motorista. Não é controle de acesso — é ausência de superfície. Sem
 * endpoint não há ranking, nem por acidente nem por pressão futura.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller({ path: 'me/performance', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriverPerformanceController {
  constructor(private readonly performance: GetDriverPerformanceUseCase) {}

  @Get()
  @Roles('driver')
  @ApiOperation({ summary: 'Desempenho consolidado, meta e sequência do próprio motorista' })
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Query('windowDays', new DefaultValuePipe(30), ParseIntPipe) windowDays: number,
  ): Promise<{ data: DriverPerformanceView }> {
    const janela = Math.min(Math.max(windowDays, 7), 180);
    // O token traz o login; o read model é por ficha. A tradução (ADR-0086)
    // fica no caso de uso.
    return { data: await this.performance.execute(user.tenantId, user.id, janela) };
  }
}
