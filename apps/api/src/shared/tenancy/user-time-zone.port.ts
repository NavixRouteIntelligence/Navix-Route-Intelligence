/**
 * Fuso horário do **utilizador** (`user_profiles.time_zone`), quando existe.
 *
 * Separado do leitor do tenant de propósito: são duas perguntas diferentes, e a
 * resposta de cada uma importa para a cadeia declarada da ADR-0122. `null`
 * significa «esta pessoa não escolheu», não «UTC».
 */
export interface UserTimeZoneReaderPort {
  findTimeZone(tenantId: string, userId: string): Promise<string | null>;
}

export const USER_TIME_ZONE_READER = Symbol('USER_TIME_ZONE_READER');
