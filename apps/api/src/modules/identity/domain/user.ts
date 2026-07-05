/**
 * Entidade de domínio User. Sem dependências de framework nem de ORM.
 * Representa um usuário dentro de um tenant (ver docs/architecture.md §4).
 */
export interface User {
  id: string;
  tenantId: string;
  email: string;
  /** Hash Argon2id da senha — nunca a senha em claro. */
  passwordHash: string;
  status: 'active' | 'suspended';
  roles: string[];
}
