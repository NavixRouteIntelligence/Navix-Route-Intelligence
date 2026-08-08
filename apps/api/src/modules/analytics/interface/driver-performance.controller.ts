import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  DriverDailySnapshot,
  DriverPerformanceView,
} from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetDriverDailySnapshotUseCase } from '../application/get-driver-daily-snapshot.use-case';
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
  constructor(
    private readonly performance: GetDriverPerformanceUseCase,
    private readonly daily: GetDriverDailySnapshotUseCase,
  ) {}

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

  /**
   * Fotografia de um dia (ADR-0117). Sem `day`, **ontem** no fuso de quem
   * opera — e o dia vem sempre na resposta, para a tela nunca ter de assumir
   * qual foi.
   */
  @Get('daily')
  @Roles('driver')
  @ApiOperation({ summary: 'Fotografia diária do próprio motorista' })
  async getDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Query('day') day?: string,
  ): Promise<{ data: DriverDailySnapshot }> {
    const dia = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
    return { data: await this.daily.execute(user.tenantId, user.id, dia) };
  }
}
