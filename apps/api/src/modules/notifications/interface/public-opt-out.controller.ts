import { Controller, HttpCode, HttpStatus, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { OptOutByTrackingTokenUseCase } from '../application/opt-out-by-tracking-token.use-case';

/**
 * Opt-out do destinatário (ADR-0084).
 *
 * **Sem autenticação por desenho** — o destinatário não tem conta. A credencial
 * é o mesmo token de rastreio que ele recebeu no e-mail, o que evita inventar um
 * segundo mecanismo público (ADR-0082).
 *
 * Rate limit estrito, como toda superfície pública: é o mesmo raciocínio do
 * endpoint de rastreio.
 */
@ApiTags('public')
@Controller({ path: 'public/tracking', version: '1' })
export class PublicOptOutController {
  constructor(private readonly optOut: OptOutByTrackingTokenUseCase) {}

  @Post(':token/opt-out')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Destinatário pede para não receber mais notificações' })
  async unsubscribe(@Param('token') token: string): Promise<void> {
    // Mesmo formato do rastreio: descarta lixo sem ir ao banco.
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Rastreamento não encontrado.');
    }
    await this.optOut.execute(token);
  }
}
