import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AcceptDriverInviteRequest, AcceptDriverInviteResponse } from '@navix/contracts';
import { DataSource } from 'typeorm';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { transactionContext } from '../../../shared/database/transaction-context';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import { AttachDriverAccountUseCase } from '../../fleet/application/drivers/attach-driver-account.use-case';
import {
  TENANT_USER_PROVISIONING,
  type TenantUserProvisioningPort,
} from '../../identity/application/tenant-user-provisioning.service';
import {
  DRIVER_INVITE_REPOSITORY,
  type DriverInviteRepositoryPort,
} from '../domain/ports/driver-invite-repository.port';

/**
 * O papel que todo convidado recebe. Fixo de propósito: um convite nunca eleva
 * privilégio. Convidar um despachante ou um gestor é outro fluxo, com outra
 * autorização — não este, cujo link circula por WhatsApp.
 */
const INVITED_ROLES = ['driver'];

/**
 * Aceite do convite (ADR-0085): o motorista cria a conta **dentro** do tenant
 * de quem o convidou e a ficha da frota ganha o login que lhe faltava.
 *
 * Três cuidados sustentam o isolamento:
 *
 * 1. **O tenant vem do token, nunca do cliente.** O comando de entrada não tem
 *    campo de tenant nem de e-mail: ambos saem do convite resolvido. É por isso
 *    que um convite de uma empresa não consegue criar usuário em outra.
 * 2. **RLS estabelecida à mão.** O request é público, então não passa pelo
 *    `TenantTransactionInterceptor` (ele só age quando há `req.user`) e não há
 *    `app.current_tenant`. Sem abrir a transação aqui, a RLS não daria erro —
 *    apenas devolveria zero linhas, e a ficha nunca seria ligada, em silêncio
 *    (o padrão que já mordeu em ADR-0082, 0083 e 0084).
 * 3. **Tudo numa transação só.** O `claim` do convite, a criação do login e o
 *    vínculo da ficha compartilham a transação: se qualquer passo falhar, o
 *    convite volta a valer em vez de queimar sem ter criado a conta.
 */
@Injectable()
export class AcceptDriverInviteUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(DRIVER_INVITE_REPOSITORY) private readonly invites: DriverInviteRepositoryPort,
    @Inject(TENANT_USER_PROVISIONING) private readonly users: TenantUserProvisioningPort,
    private readonly attachDriver: AttachDriverAccountUseCase,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(
    token: string,
    input: AcceptDriverInviteRequest,
  ): Promise<AcceptDriverInviteResponse> {
    // Fora de transação de tenant: é esta leitura que descobre o tenant. Serve
    // só para saber QUAL tenant abrir — quem de fato consome o convite é o
    // `claim` lá dentro, sob a mesma transação de tudo o mais.
    const invite = await this.invites.resolve(token);
    if (!invite) throw new NotFoundError('Convite inválido ou expirado.');

    return this.withTenant(invite.tenantId, async () => {
      const claimed = await this.invites.claim(token);
      // Perdeu a corrida para um aceite simultâneo (ou o convite mudou de
      // estado entre as duas leituras): mesma resposta de token inválido.
      if (!claimed) throw new NotFoundError('Convite inválido ou expirado.');

      const user = await this.users.provision({
        tenantId: claimed.tenantId,
        email: claimed.email,
        password: input.password,
        roles: INVITED_ROLES,
      });

      await this.attachDriver.execute({
        tenantId: claimed.tenantId,
        userId: user.id,
        driverId: claimed.driverId,
        name: input.name,
        licenseNumber: input.licenseNumber,
      });

      await this.audit.record({
        tenantId: claimed.tenantId,
        actorId: user.id,
        action: 'fleet.driver.invite-accepted',
        resource: `user:${user.id}`,
      });

      return { email: claimed.email, organizationName: claimed.organizationName };
    });
  }

  /** Abre a transação com `app.current_tenant` — o que o interceptor faria. */
  private withTenant<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query("SELECT set_config('app.current_tenant', $1, true)", [tenantId]);
      return transactionContext.run(manager, fn);
    });
  }
}
