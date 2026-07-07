import type { User } from '../user';

/** Port (interface) do repositório de usuários. Implementado na infraestrutura. */
export interface UserRepositoryPort {
  findByEmail(tenantId: string, email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
}

/** Token de injeção do Nest para a port. */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
