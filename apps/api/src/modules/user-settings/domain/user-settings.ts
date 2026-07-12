import {
  DEFAULT_USER_SETTINGS,
  TIME_FORMATS,
  UI_DENSITIES,
  UI_LOCALES,
  UI_THEMES,
  WEEK_STARTS,
  type TimeFormat,
  type UiDensity,
  type UiLocale,
  type UiTheme,
  type UpdateUserSettingsRequest,
  type UserSettings,
  type WeekStart,
} from '@navix/contracts';

/**
 * Preferências de UI de um usuário dentro de um tenant. Sem dependências de
 * framework nem de ORM (ver docs/architecture.md §3). O registro é 1:1 com o
 * usuário; quando ausente, aplicam-se os defaults do contrato.
 */
export interface UserSettingsRecord {
  tenantId: string;
  userId: string;
  settings: UserSettings;
  updatedAt: Date;
}

/** Retorna o valor se pertencer ao conjunto permitido; senão, o fallback. */
function oneOf<T>(allowed: readonly T[], value: unknown, fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Normaliza um objeto arbitrário em `UserSettings` válido: cada chave é validada
 * contra seu conjunto/tipo e cai no default quando inválida. Blinda a leitura
 * de dados legados/corrompidos e a escrita vinda da borda.
 */
export function sanitizeSettings(raw: Partial<UserSettings> | undefined | null): UserSettings {
  const base = raw ?? {};
  return {
    theme: oneOf<UiTheme>(UI_THEMES, base.theme, DEFAULT_USER_SETTINGS.theme),
    locale: oneOf<UiLocale>(UI_LOCALES, base.locale, DEFAULT_USER_SETTINGS.locale),
    reducedMotion: asBool(base.reducedMotion, DEFAULT_USER_SETTINGS.reducedMotion),
    compact: asBool(base.compact, DEFAULT_USER_SETTINGS.compact),
    density: oneOf<UiDensity>(UI_DENSITIES, base.density, DEFAULT_USER_SETTINGS.density),
    timeFormat: oneOf<TimeFormat>(TIME_FORMATS, base.timeFormat, DEFAULT_USER_SETTINGS.timeFormat),
    weekStart: oneOf<WeekStart>(WEEK_STARTS, base.weekStart, DEFAULT_USER_SETTINGS.weekStart),
  };
}

/**
 * Aplica um patch parcial sobre as preferências atuais (merge por chave;
 * last-write-wins). Chaves ausentes preservam o valor atual; valores inválidos
 * caem no default do contrato (a borda já rejeita enums inválidos no DTO —
 * isto é defesa em profundidade).
 */
export function applyPatch(
  current: UserSettings,
  patch: UpdateUserSettingsRequest,
): UserSettings {
  return sanitizeSettings({ ...current, ...patch });
}
