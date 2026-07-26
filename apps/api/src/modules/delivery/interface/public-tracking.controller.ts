import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PublicTrackingView } from '@navix/contracts';

import { GetPublicTrackingUseCase } from '../application/get-public-tracking.use-case';

/**
 * Rastreamento público da entrega (ADR-0082) — `track.navix.pt/<token>`.
 *
 * **Sem `JwtAuthGuard` por desenho:** o destinatário não tem conta. O token é a
 * credencial, e o isolamento por tenant continua sendo aplicado pela RLS dentro
 * do caso de uso.
 *
 * Rate limit **estrito** (30/min por IP, contra os 120/min globais): é a única
 * superfície não autenticada de leitura de dados, logo a mais atraente para
 * varredura de tokens. Mesmo com 32 bytes de entropia tornando a adivinhação
 * inviável, o limite corta o custo de quem tenta.
 */
@ApiTags('public')
@Controller({ path: 'public/tracking', version: '1' })
export class PublicTrackingController {
  constructor(private readonly tracking: GetPublicTrackingUseCase) {}

  @Get(':token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Status e ETA de uma entrega pelo token público' })
  async get(@Param('token') token: string): Promise<{ data: PublicTrackingView }> {
    // Formato conferido antes de ir ao banco: base64url de 32 bytes = 43
    // chars. Descarta lixo sem consultar nada.
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new NotFoundException('Rastreamento não encontrado.');
    }
    return { data: await this.tracking.execute(token) };
  }
}
