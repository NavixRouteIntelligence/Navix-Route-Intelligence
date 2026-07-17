import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError } from '../../../shared/kernel/domain-error';
import type { RefreshTokenRepositoryPort, StoredRefreshToken } from '../domain/ports/refresh-token-repository.port';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import type { User } from '../domain/user';
import { RefreshTokenUseCase } from './refresh-token.use-case';
import type { TokenServicePort } from './ports/token-service.port';

const activeUser: User = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'ops@navix.test',
  passwordHash: 'hashed',
  status: 'active',
  roles: ['admin'],
};

function storedToken(overrides: Partial<StoredRefreshToken> = {}): StoredRefreshToken {
  return {
    id: 'rt-1',
    userId: 'user-1',
    tokenHash: 'refresh-hash',
    familyId: 'fam-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    ...overrides,
  };
}

function build(overrides: { stored: StoredRefreshToken | null; user?: User | null }) {
  const users: UserRepositoryPort = {
    findByEmail: jest.fn(),
    findByEmailAndOrganization: jest.fn(),
    findById: jest.fn().mockResolvedValue(overrides.user === undefined ? activeUser : overrides.user),
    updatePassword: jest.fn(),
  };
  const refreshTokens: RefreshTokenRepositoryPort = {
    save: jest.fn().mockResolvedValue(undefined),
    findByHash: jest.fn().mockResolvedValue(overrides.stored),
    revoke: jest.fn().mockResolvedValue(undefined),
    revokeFamily: jest.fn().mockResolvedValue(undefined),
  };
  const tokens: TokenServicePort = {
    signAccessToken: jest.fn().mockResolvedValue({ token: 'new-access', expiresIn: 900 }),
    issueRefreshToken: jest.fn().mockReturnValue({
      token: 'new-refresh',
      tokenHash: 'new-hash',
      familyId: 'fam-1',
      expiresAt: new Date(Date.now() + 60_000),
    }),
    hashRefreshToken: jest.fn().mockReturnValue('refresh-hash'),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  const useCase = new RefreshTokenUseCase(users, refreshTokens, tokens, audit);
  return { useCase, users, refreshTokens, tokens, audit };
}

describe('RefreshTokenUseCase', () => {
  it('rotaciona: revoga o token atual e emite um novo par na mesma família', async () => {
    const { useCase, refreshTokens, audit } = build({ stored: storedToken() });

    const result = await useCase.execute('presented');

    expect(refreshTokens.revoke).toHaveBeenCalledWith('rt-1');
    expect(refreshTokens.save).toHaveBeenCalledWith(
      expect.objectContaining({ familyId: 'fam-1', tokenHash: 'new-hash', revokedAt: null }),
    );
    expect(result).toEqual({ accessToken: 'new-access', expiresIn: 900, refreshToken: 'new-refresh' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh.succeeded' }),
    );
  });

  it('detecta reuso de token revogado e derruba a família inteira', async () => {
    const { useCase, refreshTokens, audit } = build({
      stored: storedToken({ revokedAt: new Date() }),
    });

    await expect(useCase.execute('presented')).rejects.toThrow(UnauthorizedError);
    expect(refreshTokens.revokeFamily).toHaveBeenCalledWith('fam-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh.reuse_detected' }),
    );
    // Não emite novo token quando há reuso.
    expect(refreshTokens.save).not.toHaveBeenCalled();
  });

  it('rejeita token inexistente', async () => {
    const { useCase } = build({ stored: null });
    await expect(useCase.execute('x')).rejects.toThrow(UnauthorizedError);
  });

  it('rejeita token expirado', async () => {
    const { useCase, refreshTokens } = build({
      stored: storedToken({ expiresAt: new Date(Date.now() - 1) }),
    });
    await expect(useCase.execute('x')).rejects.toThrow(UnauthorizedError);
    expect(refreshTokens.revoke).not.toHaveBeenCalled();
  });

  it('rejeita quando o usuário não existe mais', async () => {
    const { useCase } = build({ stored: storedToken(), user: null });
    await expect(useCase.execute('x')).rejects.toThrow(UnauthorizedError);
  });

  it('rejeita quando o usuário está inativo', async () => {
    const { useCase } = build({ stored: storedToken(), user: { ...activeUser, status: 'suspended' } });
    await expect(useCase.execute('x')).rejects.toThrow(UnauthorizedError);
  });
});
