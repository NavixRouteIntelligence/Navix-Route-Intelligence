import type { User } from '../user';

/** Port (interface) do repositório de usuários. Implementado na infraestrutura. */
export interface UserRepositoryPort {
  /**
   * Resolve o usuário pelo e-mail (identidade **global**, case-insensitive). Um
   * e-mail mapeia para no máximo um usuário/tenant (ADR-0016).
   */
  findByEmail(email: string): Promise<User | null>;
  /**
   * Resolve o usuário pelo e-mail **dentro** da organização identificada pelo
   * `slug` — usado quando o cliente informa `organization` no login.
   */
  findByEmailAndOrganization(email: string, organizationSlug: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

/** Token de injeção do Nest para a port. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
