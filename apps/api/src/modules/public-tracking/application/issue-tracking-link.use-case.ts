import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { TrackingLinkResponse } from '@navix/contracts';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { FeatureAccessService } from '../../../shared/tenancy/feature-access.service';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import {
  TRACKING_TOKEN_REPOSITORY,
  type TrackingTokenRepositoryPort,
} from '../domain/ports/tracking-token-repository.port';

/**
 * 32 bytes de aleatoriedade criptográfica em base64url (43 chars). O token é a
 * **única** credencial da página pública, então precisa ser inadivinhável — e
 * opaco: não deriva do id da entrega nem do tenant, para não vazar estrutura
 * interna nem permitir enumeração.
 */
const TOKEN_BYTES = 32;

@Injectable()
export class IssueTrackingLinkUseCase {
  constructor(
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(TRACKING_TOKEN_REPOSITORY) private readonly tokens: TrackingTokenRepositoryPort,
    private readonly config: AppConfigService,
    private readonly features: FeatureAccessService,
  ) {}

  async execute(tenantId: string, deliveryId: string): Promise<TrackingLinkResponse> {
    // CX avançado é recurso de Frota/Enterprise. O gate vem antes de qualquer
    // leitura da entrega ou geração de token para não gastar recursos do plano básico.
    await this.features.require(tenantId, 'advanced_cx');

    // Confirma que a entrega existe NESTE tenant antes de emitir o link. A
    // leitura passa pela RLS, então um id de outro tenant simplesmente não é
    // encontrado — não há como emitir token para entrega alheia.
    const delivery = await this.deliveries.getPublicSnapshot(tenantId, deliveryId);
    if (!delivery) throw new NotFoundError('Entrega não encontrada.');

    // Idempotente: reemitir devolve o link vigente em vez de criar outro. Assim
    // um segundo clique não invalida o link que o destinatário já recebeu.
    const existing = await this.tokens.findActiveByDelivery(tenantId, deliveryId);
    if (existing) return this.response(existing);

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.tokens.issue(token, tenantId, deliveryId);
    return this.response(token);
  }

  private response(token: string): TrackingLinkResponse {
    return { token, url: `${this.config.publicTracking.baseUrl}/${token}` };
  }
}
