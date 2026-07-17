import { createHash } from 'node:crypto';

import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError, ValidationError } from '../../../shared/kernel/domain-error';
import type {
  PasswordResetTokenRepositoryPort,
  StoredResetToken,
} from '../domain/ports/password-reset-token-repository.port';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import { ResetPasswordUseCase } from './reset-password.use-case';
import type { PasswordHasherPort } from './ports/password-hasher.port';

const RAW_TOKEN = 'raw-reset-token';
const TOKEN_HASH = createHash('sha256').update(RAW_TOKEN).digest('hex');

function storedToken(overrides: Partial<StoredResetToken> = {}): StoredResetToken {
  return {
    id: 'prt-1',
    userId: 'user-1',
    tokenHash: TOKEN_HASH,
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    ...overrides,
  };
}

function build(stored: StoredResetToken | null) {
  const users: UserRepositoryPort = {
    findByEmail: jest.fn(),
    findByEmailAndOrganization: jest.fn(),
    findById: jest.fn(),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };
  const tokens: PasswordResetTokenRepositoryPort = {
    save: jest.fn(),
    findByHash: jest.fn().mockResolvedValue(stored),
    markUsed: jest.fn().mockResolvedValue(undefined),
  };
  const hasher: PasswordHasherPort = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn(),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  return { useCase: new ResetPasswordUseCase(users, tokens, hasher, audit), users, tokens, audit };
}

const cmd = { token: RAW_TOKEN, newPassword: 'new-password-123' };

describe('ResetPasswordUseCase', () => {
  it('redefine a senha, consome o token (markUsed) e audita', async () => {
    const { useCase, users, tokens, audit } = build(storedToken());

    await useCase.execute(cmd);

    // Procura pelo HASH do token, nunca pelo valor cru.
    expect(tokens.findByHash).toHaveBeenCalledWith(TOKEN_HASH);
    expect(users.updatePassword).toHaveBeenCalledWith('user-1', 'new-hash');
    expect(tokens.markUsed).toHaveBeenCalledWith('prt-1');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_reset.completed' }),
    );
  });

  it('rejeita nova senha curta antes de consultar o token', async () => {
    const { useCase, tokens } = build(storedToken());
    await expect(useCase.execute({ ...cmd, newPassword: 'x' })).rejects.toThrow(ValidationError);
    expect(tokens.findByHash).not.toHaveBeenCalled();
  });

  it('rejeita token inexistente', async () => {
    const { useCase, users } = build(null);
    await expect(useCase.execute(cmd)).rejects.toThrow(UnauthorizedError);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('rejeita token já usado', async () => {
    const { useCase } = build(storedToken({ usedAt: new Date() }));
    await expect(useCase.execute(cmd)).rejects.toThrow(UnauthorizedError);
  });

  it('rejeita token expirado', async () => {
    const { useCase } = build(storedToken({ expiresAt: new Date(Date.now() - 1) }));
    await expect(useCase.execute(cmd)).rejects.toThrow(UnauthorizedError);
  });
});
