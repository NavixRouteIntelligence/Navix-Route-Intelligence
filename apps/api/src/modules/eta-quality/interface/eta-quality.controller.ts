import {
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
import type { AuthenticatedUser, DelayRiskAlert } from '@navix/contracts';

import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { DelayRiskRegistry } from '../application/delay-risk.registry';
import { GetEtaQualityUseCase } from '../application/get-eta-quality.use-case';
import {
  TrainEtaModelUseCase,
  type TrainEtaModelResult,
} from '../application/train-eta-model.use-case';
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
  constructor(
    private readonly quality: GetEtaQualityUseCase,
    private readonly train: TrainEtaModelUseCase,
    private readonly risks: DelayRiskRegistry,
  ) {}

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

  /**
   * Riscos vigentes de estouro de janela (ADR-0091).
   *
   * Existe para os clientes que **não** consomem SSE — hoje o app, que usa
   * polling. O web recebe os mesmos alertas empurrados e não precisa daqui.
   */
  @Get('risks')
  @Roles('admin', 'dispatcher', 'fleet_manager')
  @ApiOperation({ summary: 'Paradas em risco de estourar a janela agora' })
  currentRisks(@CurrentUser() user: AuthenticatedUser): { data: DelayRiskAlert[] } {
    return { data: this.risks.current(user.tenantId) };
  }

  /**
   * Treina o modelo de correção e devolve a **comparação com a heurística**
   * (ADR-0090). Só publica se vencer em dados não vistos — a resposta diz qual
   * dos dois está em produção depois da chamada.
   *
   * Disparo manual de propósito nesta etapa: retreinar é uma decisão de produto
   * enquanto o corpus é pequeno, e um agendador esconderia o número de quem
   * precisa vê-lo. Automatizar é trocar quem chama, não o que faz.
   */
  @Post('train')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Treina o modelo de ETA e compara o MAE com a heurística' })
  async trainModel(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: TrainEtaModelResult }> {
    return { data: await this.train.execute(user.tenantId) };
  }
}
