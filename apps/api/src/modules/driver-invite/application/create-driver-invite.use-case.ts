import { randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import type { DriverInvite } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import { FLEET_LOOKUP, type FleetLookupPort } from '../../fleet/application/fleet-lookup.service';
import {
  TENANT_USER_PROVISIONING,
  type TenantUserProvisioningPort,
} from '../../identity/application/tenant-user-provisioning.service';
import {
  DRIVER_INVITE_REPOSITORY,
  type DriverInviteRepositoryPort,
} from '../domain/ports/driver-invite-repository.port';

/**
 * 32 bytes de aleatoriedade criptográfica em base64url (43 chars) — o mesmo
 * token opaco do rastreio público (ADR-0082). Não deriva do tenant, do e-mail
 * nem da ficha: um convite não deve revelar nada da organização a quem o
 * intercepte, nem permitir enumerar os demais.
 */
const TOKEN_BYTES = 32;

export interface CreateDriverInviteCommand {
  tenantId: string;
  /** Quem convidou (admin/fleet_manager autenticado). */
  invitedBy: string;
  email: string;
  driverId?: string;
}

@Injectable()
export class CreateDriverInviteUseCase {
  constructor(
    @Inject(DRIVER_INVITE_REPOSITORY) private readonly invites: DriverInviteRepositoryPort,
    @Inject(FLEET_LOOKUP) private readonly fleet: FleetLookupPort,
    @Inject(TENANT_USER_PROVISIONING)
    private readonly users: TenantUserProvisioningPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
    private readonly config: AppConfigService,
  ) {}

  async execute(command: CreateDriverInviteCommand): Promise<DriverInvite> {
    const email = command.email.trim().toLowerCase();

    // A ficha é lida sob a RLS do tenant de quem convida: um `driverId` de
    // outra organização simplesmente não é encontrado, então não há como emitir
    // convite que ligue um login a ficha alheia.
    if (command.driverId && !(await this.fleet.driverExists(command.tenantId, command.driverId))) {
      throw new NotFoundError('Motorista não encontrado.');
    }

    // E-mail é identidade global (ADR-0016): se já existe conta, o convite
    // morreria no aceite. Falhar aqui poupa o convidado de descobrir sozinho —
    // e é informação que quem convida já tem por outros caminhos, então não
    // revela nada novo sobre outro tenant.
    if (await this.users.emailTaken(email)) {
      throw new ConflictError('Já existe uma conta com este e-mail.');
    }

    await this.invites.revokePending(command.tenantId, email);

    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    const expiresAt = new Date(
      Date.now() + this.config.driverInvites.ttlHours * 60 * 60 * 1000,
    );
    await this.invites.create({
      token,
      tenantId: command.tenantId,
      email,
      driverId: command.driverId ?? null,
      invitedBy: command.invitedBy,
      expiresAt,
    });

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.invitedBy,
      action: 'fleet.driver.invited',
      resource: `driver-invite:${email}`,
      // Sem o token: a auditoria é lida por gente que não deveria poder
      // aceitar o convite no lugar do motorista.
      metadata: { driverId: command.driverId ?? null },
    });

    return {
      token,
      url: `${this.config.driverInvites.baseUrl}/${token}`,
      email,
      expiresAt: expiresAt.toISOString(),
    };
  }
}
