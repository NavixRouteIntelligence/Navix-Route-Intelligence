import type { UserSettingsRecord } from '../user-settings';

/**
 * Porta de persistência das preferências do usuário. A implementação é
 * escopada por tenant (RLS); os métodos recebem tenant/usuário explicitamente
 * para manter o domínio ignorante de infraestrutura.
 */
export interface UserSettingsRepositoryPort {
  /** Retorna o registro do usuário, ou `null` quando nunca configurado. */
  find(tenantId: string, userId: string): Promise<UserSettingsRecord | null>;

  /** Insere ou atualiza (upsert) as preferências do usuário. */
  save(record: UserSettingsRecord): Promise<void>;
}

export const USER_SETTINGS_REPOSITORY = Symbol('USER_SETTINGS_REPOSITORY');
