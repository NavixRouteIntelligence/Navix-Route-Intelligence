import { createHash } from 'node:crypto';

import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Inject,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type {
  AuthenticatedUser,
  KaizenDailyView,
  KaizenHistoryEntryView,
  KaizenPreferencesView,
} from '@navix/contracts';
import type { Request, Response } from 'express';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetKaizenDailyUseCase } from '../application/get-kaizen-daily.use-case';
import {
  GetKaizenHistoryUseCase,
  GetKaizenPreferencesUseCase,
  RecordKaizenFeedbackUseCase,
  SetKaizenPreferencesUseCase,
} from '../application/kaizen-feedback.use-cases';
import { KaizenFeedbackDto, KaizenPreferencesDto } from './dto/kaizen-feedback.dto';

/**
 * Resumo diário do **próprio** motorista (ADR-0120).
 *
 * `me`, e não `/drivers/:id`: não existe rota para consultar o resumo de outra
 * pessoa. Não é controlo de acesso — é ausência de superfície, a mesma decisão
 * da ADR-0097. O tenant e o utilizador saem do JWT; nenhum identificador do
 * corpo ou da query alcança o caso de uso.
 */
@ApiTags('kaizen')
@ApiBearerAuth()
@Controller({ path: 'me/kaizen', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class KaizenController {
  constructor(
    private readonly daily: GetKaizenDailyUseCase,
    private readonly feedback: RecordKaizenFeedbackUseCase,
    private readonly historico: GetKaizenHistoryUseCase,
    private readonly preferencias: SetKaizenPreferencesUseCase,
    private readonly lerPreferencias: GetKaizenPreferencesUseCase,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /**
   * Limite generoso para uso humano e apertado para varredura: a app abre o
   * resumo uma vez por dia, e quem o pede trinta vezes por minuto não o está a
   * ler.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get('daily')
  @Roles('driver')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Resumo diário do próprio motorista' })
  @ApiQuery({ name: 'day', required: false, example: '2026-08-08' })
  async getDaily(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Query('day') day?: string,
  ): Promise<{ data: KaizenDailyView } | undefined> {
    const view = await this.daily.execute(user.tenantId, user.id, day);

    // ETag sobre o corpo já montado: o resumo de um dia fechado não muda, e a
    // app abre-o várias vezes. `private` porque o conteúdo é de uma pessoa —
    // um cache partilhado a guardá-lo seria o mesmo vazamento que a rota evita.
    const etag = `"${createHash('sha1').update(JSON.stringify(view)).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    if (req.headers['if-none-match'] === etag) {
      res.status(304);
      return undefined;
    }

    // Auditoria mínima: quem leu o quê, sem copiar métrica nenhuma para o log.
    // O resumo é sobre a pessoa; duplicá-lo no registo de auditoria espalharia
    // o dado sem acrescentar rasto útil.
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'kaizen.daily-viewed',
      resource: `kaizen-daily:${view.day}`,
      metadata: { status: view.status, confidence: view.confidence },
    });

    return { data: view };
  }

  /**
   * Resposta ao Kaizen do dia (ADR-0121). **Opcional**: não responder não tem
   * consequência nenhuma, e não há nada na API que insista.
   */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('daily/feedback')
  @Roles('driver')
  @HttpCode(204)
  @ApiOperation({ summary: 'Responder à sugestão do dia (opcional)' })
  async postFeedback(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KaizenFeedbackDto,
  ): Promise<void> {
    await this.feedback.execute({
      tenantId: user.tenantId,
      userId: user.id,
      day: dto.day,
      code: dto.code,
      verdict: dto.verdict,
      reason: dto.reason ?? null,
    });

    // Auditável, e sem conteúdo: fica o rasto de que houve resposta, nunca uma
    // cópia da opinião fora da tabela que a guarda com finalidade declarada.
    await this.audit.record({
      tenantId: user.tenantId,
      actorId: user.id,
      action: 'kaizen.feedback-recorded',
      resource: `kaizen-daily:${dto.day}`,
      metadata: { verdict: dto.verdict },
    });
  }

  /** Últimos resumos e o que a pessoa respondeu, quando respondeu. */
  @Get('history')
  @Roles('driver')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Histórico dos últimos resumos do próprio motorista' })
  async getHistory(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: KaizenHistoryEntryView[] }> {
    const linhas = await this.historico.execute(user.tenantId, user.id);
    return { data: linhas as KaizenHistoryEntryView[] };
  }

  /**
   * Esconder as sugestões, mantendo os resultados.
   *
   * `PUT` e não `PATCH`: é um estado com um valor, e o cliente diz qual é —
   * ligar e desligar têm de custar exatamente o mesmo.
   */
  @Put('preferences')
  @Roles('driver')
  @ApiOperation({ summary: 'Esconder ou mostrar as sugestões diárias' })
  async putPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: KaizenPreferencesDto,
  ): Promise<{ data: KaizenPreferencesView }> {
    const prefs = {
      hideRecommendations: dto.hideRecommendations,
      reminderAt: dto.reminderAt ?? null,
    };
    await this.preferencias.execute(user.tenantId, user.id, prefs);
    return { data: prefs };
  }

  /** Preferências atuais. Sem nada guardado, devolve o padrão: nada ligado. */
  @Get('preferences')
  @Roles('driver')
  @ApiOperation({ summary: 'Preferências do resumo do próprio motorista' })
  async getPreferences(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: KaizenPreferencesView }> {
    return { data: await this.lerPreferencias.execute(user.tenantId, user.id) };
  }
}
