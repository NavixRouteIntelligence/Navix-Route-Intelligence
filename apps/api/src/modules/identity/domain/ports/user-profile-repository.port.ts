import type { UserProfileRecord } from '../user-profile';

/**
 * Porta de persistência do perfil do usuário. Implementação escopada por
 * tenant (RLS); recebe tenant/usuário explicitamente.
 */
export interface UserProfileRepositoryPort {
  find(tenantId: string, userId: string): Promise<UserProfileRecord | null>;
  save(record: UserProfileRecord): Promise<void>;
}

export const USER_PROFILE_REPOSITORY = Symbol('USER_PROFILE_REPOSITORY');
