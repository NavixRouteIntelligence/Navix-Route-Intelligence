import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import type { AppConfigService } from '../../../shared/config/app-config.service';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import type { FleetLookupPort } from '../../fleet/application/fleet-lookup.service';
import type { TenantUserProvisioningPort } from '../../identity/application/tenant-user-provisioning.service';
import type { DriverInviteRepositoryPort } from '../domain/ports/driver-invite-repository.port';
import { CreateDriverInviteUseCase } from './create-driver-invite.use-case';

const TENANT = 'tenant-a';

function build(opts: { driverExists?: boolean; emailTaken?: boolean } = {}) {
  const invites: DriverInviteRepositoryPort = {
    resolve: jest.fn(),
    claim: jest.fn(),
    revokePending: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue(undefined),
  };
  const fleet: FleetLookupPort = {
    vehicleExists: jest.fn(),
    driverExists: jest.fn().mockResolvedValue(opts.driverExists ?? true),
  };
  const users: TenantUserProvisioningPort = {
    emailTaken: jest.fn().mockResolvedValue(opts.emailTaken ?? false),
    provision: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  const config = {
    driverInvites: { baseUrl: 'https://app.navix.pt/convite', ttlHours: 168 },
  } as unknown as AppConfigService;

  return {
    uc: new CreateDriverInviteUseCase(invites, fleet, users, audit, config),
    invites,
    fleet,
    audit,
  };
}

describe('CreateDriverInviteUseCase', () => {
  it('emite token opaco de 43 chars e monta o link do convite', async () => {
    const { uc, invites } = build();

    const result = await uc.execute({
      tenantId: TENANT,
      invitedBy: 'admin-1',
      email: 'Motorista@Exemplo.PT',
      driverId: 'ficha-1',
    });

    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.url).toBe(`https://app.navix.pt/convite/${result.token}`);
    // E-mail normalizado: é a chave de unicidade do convite e do login.
    expect(result.email).toBe('motorista@exemplo.pt');
    expect(invites.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT, email: 'motorista@exemplo.pt' }),
    );
  });

  it('o convite expira dentro do prazo configurado', async () => {
    const { uc } = build();

    const result = await uc.execute({
      tenantId: TENANT,
      invitedBy: 'admin-1',
      email: 'a@b.pt',
    });

    const horas = (new Date(result.expiresAt).getTime() - Date.now()) / 3_600_000;
    expect(horas).toBeGreaterThan(167);
    expect(horas).toBeLessThanOrEqual(168);
  });

  // A ficha é lida sob RLS: um id de outra organização não é encontrado, então
  // não há como emitir convite que ligue um login a ficha alheia.
  it('ficha de outro tenant não é convidável', async () => {
    const { uc, invites } = build({ driverExists: false });

    await expect(
      uc.execute({
        tenantId: TENANT,
        invitedBy: 'admin-1',
        email: 'a@b.pt',
        driverId: 'ficha-de-outro-tenant',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(invites.create).not.toHaveBeenCalled();
  });

  it('e-mail que já tem conta (em qualquer tenant) é recusado no convite', async () => {
    const { uc, invites } = build({ emailTaken: true });

    await expect(
      uc.execute({ tenantId: TENANT, invitedBy: 'admin-1', email: 'ja@existe.pt' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(invites.create).not.toHaveBeenCalled();
  });

  it('reconvidar substitui o convite pendente', async () => {
    const { uc, invites } = build();

    await uc.execute({ tenantId: TENANT, invitedBy: 'admin-1', email: 'a@b.pt' });

    expect(invites.revokePending).toHaveBeenCalledWith(TENANT, 'a@b.pt');
  });

  it('não registra o token na auditoria', async () => {
    const { uc, audit } = build();

    const result = await uc.execute({ tenantId: TENANT, invitedBy: 'admin-1', email: 'a@b.pt' });

    const entry = (audit.record as jest.Mock).mock.calls[0][0];
    expect(JSON.stringify(entry)).not.toContain(result.token);
    expect(entry).toMatchObject({ tenantId: TENANT, actorId: 'admin-1' });
  });
});
