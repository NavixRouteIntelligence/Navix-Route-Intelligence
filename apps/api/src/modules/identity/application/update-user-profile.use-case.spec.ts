import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import type { User } from '../domain/user';
import type { UserProfileRecord } from '../domain/user-profile';
import type { UserProfileRepositoryPort } from '../domain/ports/user-profile-repository.port';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { UpdateUserProfileUseCase } from './update-user-profile.use-case';

/**
 * Testa merge/validação do perfil isolado da infraestrutura (fakes das ports),
 * conforme docs/coding-standards.md §7.
 */
describe('UpdateUserProfileUseCase', () => {
  const tenantId = 'tenant-1';
  const userId = 'user-1';

  const user: User = {
    id: userId,
    tenantId,
    email: 'ana.souza@navix.test',
    passwordHash: 'hash',
    status: 'active',
    roles: ['admin'],
  };

  function makeProfiles(initial: UserProfileRecord | null): {
    repo: UserProfileRepositoryPort;
    saved: () => UserProfileRecord | null;
  } {
    let stored = initial;
    return {
      repo: {
        find: jest.fn().mockImplementation(async () => stored),
        save: jest.fn().mockImplementation(async (r: UserProfileRecord) => {
          stored = r;
        }),
      },
      saved: () => stored,
    };
  }

  const users: UserRepositoryPort = {
    findByEmail: jest.fn(),
    findByEmailAndOrganization: jest.fn(),
    findById: jest.fn().mockResolvedValue(user),
    updatePassword: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => jest.clearAllMocks());

  it('cria o perfil a partir do default derivado do e-mail e aplica o patch', async () => {
    const { repo, saved } = makeProfiles(null);
    const useCase = new UpdateUserProfileUseCase(repo, users, audit);

    const result = await useCase.execute({
      tenantId,
      userId,
      patch: { displayName: 'Ana Souza', jobTitle: 'Gerente de Operações' },
    });

    expect(result.displayName).toBe('Ana Souza');
    expect(result.jobTitle).toBe('Gerente de Operações');
    expect(result.timeZone).toBe('America/Sao_Paulo'); // default preservado
    expect(saved()?.profile.displayName).toBe('Ana Souza');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'profile.updated', tenantId, actorId: userId }),
    );
  });

  it('normaliza telefone E.164 e limpa opcional com null', async () => {
    const { repo } = makeProfiles(null);
    const useCase = new UpdateUserProfileUseCase(repo, users, audit);

    const result = await useCase.execute({
      tenantId,
      userId,
      patch: { phone: '+55 (11) 99999-8888', jobTitle: null },
    });

    expect(result.phone).toBe('+5511999998888');
    expect(result.jobTitle).toBeNull();
  });

  it('rejeita telefone inválido', async () => {
    const { repo } = makeProfiles(null);
    const useCase = new UpdateUserProfileUseCase(repo, users, audit);

    await expect(
      useCase.execute({ tenantId, userId, patch: { phone: 'abc123' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita nome de exibição muito curto', async () => {
    const { repo } = makeProfiles(null);
    const useCase = new UpdateUserProfileUseCase(repo, users, audit);

    await expect(
      useCase.execute({ tenantId, userId, patch: { displayName: 'A' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita patch vazio', async () => {
    const { repo } = makeProfiles(null);
    const useCase = new UpdateUserProfileUseCase(repo, users, audit);

    await expect(useCase.execute({ tenantId, userId, patch: {} })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});
