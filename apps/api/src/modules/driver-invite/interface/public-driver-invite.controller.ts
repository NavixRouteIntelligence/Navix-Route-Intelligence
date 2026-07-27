import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type {
  AcceptDriverInviteResponse,
  DriverInvitePreview,
  ResourceResponse,
} from '@navix/contracts';

import { AcceptDriverInviteUseCase } from '../application/accept-driver-invite.use-case';
import { ValidateDriverInviteUseCase } from '../application/validate-driver-invite.use-case';
import { AcceptDriverInviteDto } from './dto/accept-driver-invite.dto';

/** base64url de 32 bytes = 43 caracteres (ADR-0082/0085). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Convite de motorista — o lado **público** (ADR-0085).
 *
 * **Sem `JwtAuthGuard` por desenho:** o convidado ainda não tem conta; criá-la
 * é justamente o objetivo. O token é a credencial, e o tenant sai dele, nunca
 * do que o cliente enviar.
 *
 * Rate limit estrito, como no rastreio público: 30/min para validar e 10/min
 * para aceitar. Aceitar é uma escrita que cria usuário — merece o limite mais
 * apertado das duas.
 */
@ApiTags('public')
@Controller({ path: 'public/driver-invites', version: '1' })
export class PublicDriverInviteController {
  constructor(
    private readonly validateInvite: ValidateDriverInviteUseCase,
    private readonly acceptInvite: AcceptDriverInviteUseCase,
  ) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verifica um convite de motorista pelo token' })
  async validate(@Param('token') token: string): Promise<ResourceResponse<DriverInvitePreview>> {
    this.assertTokenShape(token);
    return { data: await this.validateInvite.execute(token) };
  }

  @Post(':token/accept')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cria a conta do motorista dentro da organização que o convidou' })
  async accept(
    @Param('token') token: string,
    @Body() dto: AcceptDriverInviteDto,
  ): Promise<ResourceResponse<AcceptDriverInviteResponse>> {
    this.assertTokenShape(token);
    return { data: await this.acceptInvite.execute(token, dto) };
  }

  /**
   * Formato conferido antes de ir ao banco: descarta lixo sem consultar nada.
   * O 404 é o mesmo de convite inexistente, expirado ou já aceito — não
   * confirmar a existência de um token é o que impede sondagem.
   */
  private assertTokenShape(token: string): void {
    if (!TOKEN_PATTERN.test(token)) {
      throw new NotFoundException('Convite inválido ou expirado.');
    }
  }
}
