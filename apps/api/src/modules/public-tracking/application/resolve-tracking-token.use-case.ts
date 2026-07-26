import { Inject, Injectable } from '@nestjs/common';

import {
  TRACKING_TOKEN_REPOSITORY,
  type TrackingTokenRef,
  type TrackingTokenRepositoryPort,
} from '../domain/ports/tracking-token-repository.port';

/**
 * Resolve um token público em `{ tenantId, deliveryId }` — a **API pública**
 * deste módulo para quem precisa interpretar o token sem alcançar o
 * repositório (ADR-0084).
 *
 * Existe porque o opt-out do destinatário usa o mesmo token do e-mail: sem
 * isto, o módulo de notificações teria de injetar o repositório daqui, furando
 * a fronteira que os gateways anti-corrupção mantêm.
 *
 * Devolve `null` para token inexistente ou revogado — quem chama decide o que
 * responder, sem distinguir os dois casos.
 */
@Injectable()
export class ResolveTrackingTokenUseCase {
  constructor(
    @Inject(TRACKING_TOKEN_REPOSITORY) private readonly tokens: TrackingTokenRepositoryPort,
  ) {}

  execute(token: string): Promise<TrackingTokenRef | null> {
    return this.tokens.resolve(token);
  }
}
