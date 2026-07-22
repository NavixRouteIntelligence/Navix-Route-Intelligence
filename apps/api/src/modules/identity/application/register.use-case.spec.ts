import type { DataSource } from 'typeorm';

import type { AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import type { RefreshTokenRepositoryPort } from '../domain/ports/refresh-token-repository.port';
import type { PasswordHasherPort } from './ports/password-hasher.port';
import type { TokenServicePort } from './ports/token-service.port';
import { RegisterUseCase } from './register.use-case';

/** Simula o QueryFailedError (SQLSTATE 23505) do Postgres para um índice único. */
function uniqueViolation(constraint: string): Error {
  const err = new Error('duplicate key value violates unique constraint') as Error & {
    code: string;
    constraint: string;
  };
  err.code = '23505';
  err.constraint = constraint;
  return err;
}

function build(opts: { emailExists?: boolean; failUsersInsert?: Error } = {}) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const dataSource = {
    transaction: async (fn: (m: unknown) => Promise<unknown>) =>
      fn({
        query: async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          if (opts.failUsersInsert && sql.includes('INSERT INTO users')) throw opts.failUsersInsert;
          if (sql.includes('SELECT 1 FROM users')) return opts.emailExists ? [{ one: 1 }] : [];
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
    // Slug único derivado do nome + sufixo do id (ADR-0016).
    expect(tenantInsert?.params[3]).toMatch(/^acme-log-[0-9a-f]{6}$/);
    expect(audits).toContain('auth.registered');
  });

  it('rejeita e-mail já cadastrado (identidade global)', async () => {
    const { uc } = build({ emailExists: true });
    await expect(
      uc.execute({
        accountType: 'company',
        name: 'Ana',
        email: 'dup@acme.com',
        password: 'supersecret',
        organizationName: 'ACME Log',
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('corrida: violação do índice único de e-mail vira ConflictError (sem retry)', async () => {
    const { uc, queries } = build({ failUsersInsert: uniqueViolation('uq_users_email_lower') });
    await expect(
      uc.execute({
        accountType: 'company',
        name: 'Ana',
        email: 'race@acme.com',
        password: 'supersecret',
        organizationName: 'ACME Log',
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    // E-mail duplicado é definitivo: não reprocessa (exatamente 1 insert de tenant).
    expect(queries.filter((q) => q.sql.includes('INSERT INTO tenants'))).toHaveLength(1);
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
