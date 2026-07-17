import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { UnauthorizedError, ValidationError } from '../../../shared/kernel/domain-error';
import type { UserRepositoryPort } from '../domain/ports/user-repository.port';
import type { User } from '../domain/user';
import { ChangePasswordUseCase } from './change-password.use-case';
import type { PasswordHasherPort } from './ports/password-hasher.port';

const user: User = {
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'ops@navix.test',
  passwordHash: 'old-hash',
  status: 'active',
  roles: ['admin'],
};

function build(opts: { user?: User | null; currentValid?: boolean } = {}) {
  const users: UserRepositoryPort = {
    findByEmail: jest.fn(),
    findByEmailAndOrganization: jest.fn(),
    findById: jest.fn().mockResolvedValue(opts.user === undefined ? user : opts.user),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };
  const hasher: PasswordHasherPort = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    verify: jest.fn().mockResolvedValue(opts.currentValid ?? true),
  };
  const audit: AuditLogPort = { record: jest.fn().mockResolvedValue(undefined) };
  return { useCase: new ChangePasswordUseCase(users, hasher, audit), users, hasher, audit };
}

const cmd = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  currentPassword: 'old-password',
  newPassword: 'new-password-123',
};

describe('ChangePasswordUseCase', () => {
  it('troca a senha após validar a atual e audita', async () => {
    const { useCase, users, hasher, audit } = build();

    await useCase.execute(cmd);

    expect(hasher.verify).toHaveBeenCalledWith('old-hash', 'old-password');
    expect(users.updatePassword).toHaveBeenCalledWith('user-1', 'new-hash');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password.changed' }),
    );
  });

  it('rejeita nova senha curta (< 8) antes de tocar o repositório', async () => {
    const { useCase, users } = build();

    await expect(useCase.execute({ ...cmd, newPassword: 'curta' })).rejects.toThrow(ValidationError);
    expect(users.findById).not.toHaveBeenCalled();
  });

  it('rejeita quando a senha atual está incorreta e não atualiza', async () => {
    const { useCase, users } = build({ currentValid: false });

    await expect(useCase.execute(cmd)).rejects.toThrow(UnauthorizedError);
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it('rejeita quando o usuário não existe', async () => {
    const { useCase } = build({ user: null });
    await expect(useCase.execute(cmd)).rejects.toThrow(UnauthorizedError);
  });
});
