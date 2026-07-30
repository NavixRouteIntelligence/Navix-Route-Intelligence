/**
 * Detecta violação de índice único do Postgres (SQLSTATE 23505) para uma
 * constraint/índice específico. TypeORM embrulha o erro do driver, então
 * checamos tanto o topo quanto `driverError`. Erros que não são do banco
 * (ex.: um `ConflictError` de check preventivo) não têm `code`/`constraint`,
 * então nunca casam e continuam subindo intactos.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as {
    code?: string;
    constraint?: string;
    driverError?: { code?: string; constraint?: string };
  };
  const driver = e?.driverError ?? e;
  return driver?.code === '23505' && driver?.constraint === constraint;
}

/** Índice único global de e-mail (`lower(email)`) — migração TenantSlugAndEmailIdentity. */
export const USER_EMAIL_CONSTRAINT = 'uq_users_email_lower';
