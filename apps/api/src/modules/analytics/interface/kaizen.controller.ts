import { createHash } from 'node:crypto';

import { Controller, Get, Header, Inject, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser, KaizenDailyView } from '@navix/contracts';
import type { Request, Response } from 'express';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { CurrentUser } from '../../../shared/interface/current-user.decorator';
import { JwtAuthGuard } from '../../../shared/security/jwt-auth.guard';
import { Roles } from '../../../shared/security/roles.decorator';
import { RolesGuard } from '../../../shared/security/roles.guard';
import { GetKaizenDailyUseCase } from '../application/get-kaizen-daily.use-case';

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
}
