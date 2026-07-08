import type { DataSource } from 'typeorm';

import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ValidationError } from '../../../shared/kernel/domain-error';
import type { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { TokenServicePort } from './ports/token-service.port';
import { RegisterUseCase } from './register.use-case';

function build() {
  const queries: { sql: string; params: unknown[] }[] = [];
  const dataSource = {
    transaction: async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        query: async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          return [];
        },
      }),
  } as unknown as DataSource;

  const hasher: PasswordHasherPort = {
    hash: async () => 'hashed',
    verify: async () => true,
  };
  const tokens: TokenServicePort = {
    signAccessToken: async () => ({ token: 'access', expiresIn: 900 }),
    issueRefreshToken: () => ({
      token: 'refresh',
      tokenHash: 'hash',
      familyId: 'fam',
      expiresAt: new Date(),
    }),
    hashRefreshToken: () => 'hash',
  };
  const saved: unknown[] = [];
  const refreshTokens: RefreshTokenRepositoryPort = {
    save: async (t) => void saved.push(t),
    findByHash: async () => null,
    revoke: async () => undefined,
    revokeFamily: async () => undefined,
  };
  const audits: string[] = [];
  const audit: AuditLogPort = { record: async (e) => void audits.push(e.action) };

  const uc = new RegisterUseCase(dataSource, hasher, tokens, refreshTokens, audit);
  return { uc, queries, audits };
}

describe('RegisterUseCase', () => {
  it('empresa: cria tenant company + usuário admin e autentica', async () => {
    const { uc, queries, audits } = build();
    const res = await uc.execute({
      accountType: 'company',
      name: 'Ana',
      email: 'Ana@ACME.com',
      password: 'supersecret',
      organizationName: 'ACME Log',
    });

    expect(res.accountType).toBe('company');
    expect(res.user.roles).toEqual(['admin']);
    expect(res.user.email).toBe('ana@acme.com'); // normalizado
    expect(res.tokens.accessToken).toBe('access');

    const tenantInsert = queries.find((q) => q.sql.includes('INSERT INTO tenants'));
    expect(tenantInsert?.params).toEqual(expect.arrayContaining(['ACME Log', 'company']));
    expect(audits).toContain('auth.registered');
  });

  it('motorista autônomo: cria organização pessoal + usuário driver', async () => {
    const { uc, queries } = build();
    const res = await uc.execute({
      accountType: 'driver',
      name: 'João Silva',
      email: 'joao@x.com',
      password: 'supersecret',
    });

    expect(res.accountType).toBe('driver');
    expect(res.user.roles).toEqual(['driver']);
    const tenantInsert = queries.find((q) => q.sql.includes('INSERT INTO tenants'));
    expect(tenantInsert?.params).toEqual(expect.arrayContaining(['Conta de João Silva', 'driver']));
  });

  it('empresa sem nome da organização é rejeitada', async () => {
    const { uc } = build();
    await expect(
      uc.execute({ accountType: 'company', name: 'Ana', email: 'a@a.com', password: 'supersecret' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
