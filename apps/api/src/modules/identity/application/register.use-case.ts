import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { AuthResultWithAccount, RegisterRequest } from '@navix/contracts';
import { DataSource } from 'typeorm';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';

/** Slug base a partir de um nome (sem o sufixo de unicidade). */
function slugify(value: string): string {
  const base = value
    .normalize('NFKD')
    // Remove as marcas de acento (combining diacritical marks U+0300–U+036F) do NFKD.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 40);
  return base || 'org';
}
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepositoryPort,
} from '../domain/ports/refresh-token-repository.port';
import { PASSWORD_HASHER, type PasswordHasherPort } from './ports/password-hasher.port';
import { TOKEN_SERVICE, type TokenServicePort } from './ports/token-service.port';

/** Índice único global de e-mail (lower(email)) — ver migração TenantSlugAndEmailIdentity. */
const USER_EMAIL_CONSTRAINT = 'uq_users_email_lower';

/**
 * Detecta violação de índice único do Postgres (SQLSTATE 23505) para uma
 * constraint/índice específico. TypeORM embrulha o erro do driver, então
 * checamos tanto o topo quanto `driverError`. Erros que não são do banco
 * (ex.: `ConflictError` do check preventivo) não têm `code`/`constraint`,
 * então nunca casam.
 */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  const driver = e?.driverError ?? e;
  return driver?.code === '23505' && driver?.constraint === constraint;
}

/**
 * Criação de conta com escolha de perfil (Motorista Autônomo × Empresa).
 *
 * - **Empresa**: cria a organização e o usuário como `admin` → Dashboard admin.
 * - **Motorista Autônomo**: cria uma organização pessoal e o usuário como
 *   `driver` (motorista principal) → Dashboard do Motorista.
 *
 * Tenant + usuário são criados numa única transação. Como `users` roda com RLS
 * desabilitada (fluxos públicos pré-tenant) e `tenants` não tem RLS, não é
 * preciso contexto de tenant aqui. O `account_type` no tenant deixa a futura
 * migração Autônomo → Empresa possível sem perda de dados.
 */
@Injectable()
export class RegisterUseCase {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasherPort,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenServicePort,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: RegisterRequest): Promise<AuthResultWithAccount> {
    const accountType = command.accountType;
    const name = command.name.trim();
    const email = command.email.trim().toLowerCase();

    if (!name) {
      throw new ValidationError('Nome é obrigatório.');
    }
    const organizationName =
      accountType === 'company'
        ? (command.organizationName ?? '').trim()
        : `Conta de ${name}`;
    if (accountType === 'company' && !organizationName) {
      throw new ValidationError('Nome da empresa é obrigatório.');
    }

    const roles = accountType === 'company' ? ['admin'] : ['driver'];
    const passwordHash = await this.hasher.hash(command.password);
    const tenantId = newId();
    const userId = newId();
    // Slug único da organização (identificador de login alternativo — ADR-0016).
    // Sufixo do id garante unicidade sem consulta extra nem corrida.
    const slug = `${slugify(organizationName)}-${tenantId.replace(/-/g, '').slice(0, 6)}`;

    try {
      await this.dataSource.transaction(async (manager) => {
        // E-mail é identidade global: rejeita duplicata com erro amigável (o índice
        // único do banco é a rede de segurança contra corrida).
        const existing = (await manager.query(
          `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          [email],
        )) as unknown[];
        if (existing.length > 0) {
          throw new ConflictError('E-mail já cadastrado.');
        }
        await manager.query(
          `INSERT INTO tenants (id, name, account_type, slug) VALUES ($1, $2, $3, $4)`,
          [tenantId, organizationName, accountType, slug],
        );
        await manager.query(
          `INSERT INTO users (id, tenant_id, email, password_hash, status, roles)
             VALUES ($1, $2, $3, $4, 'active', $5)`,
          [userId, tenantId, email, passwordHash, roles],
        );
      });
    } catch (err) {
      // Corrida: dois cadastros simultâneos com o mesmo e-mail podem passar pelo
      // SELECT preventivo (ambos vazios) e só colidir no índice único global.
      // Mapeia o 23505 para o mesmo 409 amigável. E-mail duplicado é definitivo:
      // não há retry (diferente de uma colisão aleatória de identificador).
      // `ConflictError` do check preventivo não casa (não é erro do banco) e é
      // re-lançado intacto.
      if (isUniqueViolation(err, USER_EMAIL_CONSTRAINT)) {
        throw new ConflictError('E-mail já cadastrado.');
      }
      throw err;
    }

    const access = await this.tokens.signAccessToken({ sub: userId, tenantId, roles });
    const refresh = this.tokens.issueRefreshToken(userId);
    await this.refreshTokens.save({
      id: newId(),
      userId,
      tokenHash: refresh.tokenHash,
      familyId: refresh.familyId,
      expiresAt: refresh.expiresAt,
      revokedAt: null,
    });

    await this.audit.record({
      tenantId,
      actorId: userId,
      action: 'auth.registered',
      resource: `user:${userId}`,
      metadata: { accountType, organizationName },
    });

    return {
      user: { id: userId, tenantId, email, roles },
      tokens: {
        accessToken: access.token,
        expiresIn: access.expiresIn,
        refreshToken: refresh.token,
      },
      accountType,
    };
  }
}
