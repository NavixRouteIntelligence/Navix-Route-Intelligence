import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { TokenServicePort } from './ports/token-service.port';
import type { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import type { User } from '../domain/user';
import { LoginUseCase } from './login.use-case';

/**
 * Testa a lógica de negócio do login isolada da infraestrutura (fakes das ports),
 * conforme docs/coding-standards.md §7.
 */
describe('LoginUseCase', () => {
  const activeUser: User = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'ops@navix.test',
    passwordHash: 'hashed',
    status: 'active',
    roles: ['admin'],
  };

  const tokenService: TokenServicePort = {
    signAccessToken: jest.fn().mockResolvedValue({ token: 'access', expiresIn: 900 }),
    issueRefreshToken: jest.fn().mockReturnValue({
      token: 'refresh',
      tokenHash: 'refresh-hash',
      familyId: 'fam-1',
      expiresAt: new Date(Date.now() + 1000),
    }),
    hashRefreshToken: jest.fn().mockReturnValue('refresh-hash'),
  };

  const refreshRepo: RefreshTokenRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn(),
    revoke: jest.fn(),
    revokeFamily: jest.fn(),
  };

  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };

  function buildUseCase(overrides: {
    user: User | null;
    passwordValid: boolean;
  }): LoginUseCase {
    const users: UserRepositoryPort = {
      findByEmail: jest.fn().mockResolvedValue(overrides.user),
      findByEmailAndOrganization: jest.fn().mockResolvedValue(overrides.user),
      findById: jest.fn(),
      updatePassword: jest.fn().mockResolvedValue(undefined),
    };
    const hasher: PasswordHasherPort = {
      hash: jest.fn(),
      verify: jest.fn().mockResolvedValue(overrides.passwordValid),
    };
    return new LoginUseCase(users, refreshRepo, hasher, tokenService, audit);
  }

  it('emite tokens quando as credenciais são válidas', async () => {
    const useCase = buildUseCase({ user: activeUser, passwordValid: true });

    const result = await useCase.execute({
      email: 'ops@navix.test',
      password: 'correct-password',
    });

    expect(result.user.id).toBe('user-1');
    expect(result.tokens.accessToken).toBe('access');
    expect(result.tokens.refreshToken).toBe('refresh');
    expect(refreshRepo.save).toHaveBeenCalled();
  });

  it('resolve o tenant pela organização (slug) quando informada', async () => {
    const useCase = buildUseCase({ user: activeUser, passwordValid: true });
    const result = await useCase.execute({
      email: 'ops@navix.test',
      password: 'correct-password',
      organization: 'acme-log',
    });
    expect(result.user.id).toBe('user-1');
  });

  it('rejeita quando o usuário não existe', async () => {
    const useCase = buildUseCase({ user: null, passwordValid: false });
    await expect(
      useCase.execute({ email: 'x@y.z', password: 'whatever-123' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejeita quando a senha é inválida', async () => {
    const useCase = buildUseCase({ user: activeUser, passwordValid: false });
    await expect(
      useCase.execute({ email: 'ops@navix.test', password: 'wrong-pass' }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
