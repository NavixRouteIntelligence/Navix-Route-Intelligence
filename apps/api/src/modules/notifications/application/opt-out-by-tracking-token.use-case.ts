import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { AppConfigService } from '../../../shared/config/app-config.service';
import { transactionContext } from '../../../shared/database/transaction-context';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { ResolveTrackingTokenUseCase } from '../../public-tracking/application/resolve-tracking-token.use-case';
import {
  NOTIFICATION_REGISTRY,
  type NotificationRegistryPort,
} from '../domain/ports/notification-registry.port';
import {
  DELIVERY_CONTACT_GATEWAY,
  type DeliveryContactGatewayPort,
} from './ports/notification-sources.port';

/**
 * "Não quero mais receber" (ADR-0084), a partir do token de rastreio que o
 * destinatário já tem no e-mail.
 *
 * Como o request é **público**, o tenant vem do token e a transação de tenant é
 * aberta à mão — mesmo desenho do rastreamento público (ADR-0082), pelas mesmas
 * razões de RLS.
 *
 * O opt-out é por **endereço**, não por entrega: quem pede para sair não quer
 * receber sobre as próximas também.
 */
@Injectable()
export class OptOutByTrackingTokenUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: AppConfigService,
    private readonly tokens: ResolveTrackingTokenUseCase,
    @Inject(DELIVERY_CONTACT_GATEWAY) private readonly deliveries: DeliveryContactGatewayPort,
    @Inject(NOTIFICATION_REGISTRY) private readonly registry: NotificationRegistryPort,
  ) {}

  async execute(token: string): Promise<void> {
    const ref = await this.tokens.execute(token);
    // Mesma resposta para token inexistente ou revogado: não confirmar
    // existência é o que impede sondagem.
    if (!ref) throw new NotFoundError('Rastreamento não encontrado.');

    await this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [ref.tenantId]);
      await transactionContext.run(manager, async () => {
        const delivery = await this.deliveries.find(ref.tenantId, ref.deliveryId);
        if (!delivery) throw new NotFoundError('Rastreamento não encontrado.');

        const channel = this.config.notifications.channel;
        const destination =
          channel === 'email' ? delivery.recipientEmail : delivery.recipientPhone;
        // Sem contato não há o que descadastrar — e responder 204 assim mesmo
        // evita revelar se aquela entrega tinha e-mail.
        if (!destination) return;

        await this.registry.optOut(ref.tenantId, channel, destination);
      });
    });
  }
}
