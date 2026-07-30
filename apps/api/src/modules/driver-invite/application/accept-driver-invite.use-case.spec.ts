import type { DataSource, EntityManager } from 'typeorm';

import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, NotFoundError } from '../../../shared/kernel/domain-error';
import type { AttachDriverAccountUseCase } from '../../fleet/application/drivers/attach-driver-account.use-case';
import type { TenantUserProvisioningPort } from '../../identity/application/tenant-user-provisioning.service';
import type {
  DriverInviteRef,
  DriverInviteRepositoryPort,
} from '../domain/ports/driver-invite-repository.port';
import { AcceptDriverInviteUseCase } from './accept-driver-invite.use-case';

const TOKEN = 'a'.repeat(43);
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

/** Grava os `set_config` executados: é como o teste prova que a RLS foi ligada. */
function dataSourceSpy(): { ds: DataSource; tenantSets: string[]; rolledBack: () => boolean } {
  const tenantSets: string[] = [];
  let rolledBack = false;
  const manager = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      if (sql.includes('app.current_tenant')) tenantSets.push(String(params?.[0]));
      return Promise.resolve([]);
    }),
    getRepository: jest.fn(),
  } as unknown as EntityManager;

  const ds = {
    transaction: async (fn: (m: EntityManager) => Promise<unknown>) => {
      try {
        return await fn(manager);
      } catch (err) {
        // O que o Postgres faria: erro dentro da transação desfaz tudo.
        rolledBack = true;
        throw err;
      }
    },
  } as unknown as DataSource;

  return { ds, tenantSets, rolledBack: () => rolledBack };
}

function ref(overrides: Partial<DriverInviteRef> = {}): DriverInviteRef {
  return {
    tenantId: TENANT_A,
    organizationName: 'Transportes A',
    email: 'motorista@exemplo.pt',
    driverId: 'ficha-1',
    ...overrides,
  };
}

function build(opts: {
  resolved?: DriverInviteRef | null;
  claimed?: DriverInviteRef | null;
  provisionError?: Error;
} = {}) {
  const { ds, tenantSets, rolledBack } = dataSourceSpy();
  const resolved = opts.resolved === undefined ? ref() : opts.resolved;
  const claimed = opts.claimed === undefined ? resolved : opts.claimed;

  const invites: DriverInviteRepositoryPort = {
    resolve: jest.fn().mockResolvedValue(resolved),
    claim: jest.fn().mockResolvedValue(claimed),
    revokePending: jest.fn(),
    create: jest.fn(),
  };
  const provision = opts.provisionError
    ? jest.fn().mockRejectedValue(opts.provisionError)
    : jest.fn().mockResolvedValue({ id: 'user-novo' });
  const users: TenantUserProvisioningPort = { emailTaken: jest.fn(), provision };
  const attach = jest.fn().mockResolvedValue({ driverId: 'ficha-1' });
  const attachDriver = { execute: attach } as unknown as AttachDriverAccountUseCase;
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

  return {
    uc: new AcceptDriverInviteUseCase(ds, invites, users, attachDriver, audit),
    invites,
    provision,
    attach,
    tenantSets,
    rolledBack,
  };
}

describe('AcceptDriverInviteUseCase', () => {
  // A garantia central desta fatia: o convidado não escolhe a organização em
  // que entra. Nada no corpo do request influencia o tenant.
  it('cria o usuário no tenant do TOKEN, não em nada vindo do cliente', async () => {
    const { uc, provision, attach, tenantSets } = build();

    await uc.execute(TOKEN, { password: 'senha-forte-123' });

    expect(tenantSets).toEqual([TENANT_A]);
    expect(provision).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, email: 'motorista@exemplo.pt' }),
    );
    expect(attach).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_A }));
  });

  // Sem `app.current_tenant` a RLS não dá erro — devolve zero linhas, e a ficha
  // ficaria sem vínculo em silêncio (ADR-0082/0083/0084).
  it('liga a ficha DENTRO da transação de tenant já aberta', async () => {
    const { uc, attach, tenantSets } = build();

    await uc.execute(TOKEN, { password: 'senha-forte-123' });

    // O tenant foi estabelecido antes de qualquer escrita no Fleet.
    expect(tenantSets).toHaveLength(1);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('um convite nunca concede papel além de driver', async () => {
    const { uc, provision } = build();

    await uc.execute(TOKEN, { password: 'senha-forte-123' });

    expect(provision).toHaveBeenCalledWith(expect.objectContaining({ roles: ['driver'] }));
  });

  it('token inválido ou expirado não chega a abrir transação nem criar conta', async () => {
    const { uc, provision, tenantSets } = build({ resolved: null });

    await expect(uc.execute(TOKEN, { password: 'senha-forte-123' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(tenantSets).toEqual([]);
    expect(provision).not.toHaveBeenCalled();
  });

  // Dois cliques simultâneos no mesmo link: só um `claim` casa o
  // `accepted_at IS NULL`; o outro não pode criar um segundo login.
  it('aceite concorrente que perde a corrida não cria segunda conta', async () => {
    const { uc, provision } = build({ claimed: null });

    await expect(uc.execute(TOKEN, { password: 'senha-forte-123' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(provision).not.toHaveBeenCalled();
  });

  // E-mail é identidade global (ADR-0016): quem já é de outro tenant não entra
  // neste. O 409 sobe e a transação desfaz o `claim` — o convite não queima.
  it('quem já tem conta em outro tenant não consegue aceitar', async () => {
    const { uc, attach, rolledBack } = build({
      provisionError: new ConflictError('E-mail já cadastrado.'),
    });

    await expect(uc.execute(TOKEN, { password: 'senha-forte-123' })).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(attach).not.toHaveBeenCalled();
    expect(rolledBack()).toBe(true);
  });

  // O tenant é relido no `claim`, dentro da transação — é ele, e não a leitura
  // preliminar, que manda em tudo o que é escrito.
  it('usa o tenant devolvido pelo claim, não o da leitura preliminar', async () => {
    const { uc, provision } = build({
      resolved: ref({ tenantId: TENANT_A }),
      claimed: ref({ tenantId: TENANT_B, organizationName: 'Transportes B' }),
    });

    const result = await uc.execute(TOKEN, { password: 'senha-forte-123' });

    expect(provision).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_B }));
    expect(result.organizationName).toBe('Transportes B');
  });

  it('repassa nome e CNH quando o convite ainda não tem ficha', async () => {
    const { uc, attach } = build({ resolved: ref({ driverId: null }) });

    await uc.execute(TOKEN, {
      password: 'senha-forte-123',
      name: 'Maria Souza',
      licenseNumber: 'CNH-99',
    });

    expect(attach).toHaveBeenCalledWith(
      expect.objectContaining({ driverId: null, name: 'Maria Souza', licenseNumber: 'CNH-99' }),
    );
  });
});
