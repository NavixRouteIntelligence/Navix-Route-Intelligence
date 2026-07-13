/**
 * Contratos de Configurações do usuário (por usuário, sincronizadas entre
 * dispositivos). Cobre Tema, Idioma e Preferências de UI — a fundação da área
 * de Configurações (ver docs/modules/settings.md §3.3–3.5).
 * Tipos puros, sem dependências de framework.
 */

/** Tema da interface. */
export type UiTheme = 'light' | 'dark' | 'system';
export const UI_THEMES: readonly UiTheme[] = ['light', 'dark', 'system'];

/**
 * Locale da interface. Espelha a lista suportada pelo dicionário do web
 * (apps/web/src/lib/i18n/dictionary.ts) — fonte única do conteúdo traduzido.
 */
export type UiLocale = 'pt-BR' | 'pt-PT' | 'en' | 'es';
export const UI_LOCALES: readonly UiLocale[] = ['pt-BR', 'pt-PT', 'en', 'es'];

/** Densidade de espaçamento das listas/tabelas. */
export type UiDensity = 'comfortable' | 'compact';
export const UI_DENSITIES: readonly UiDensity[] = ['comfortable', 'compact'];

/** Formato de hora exibido. */
export type TimeFormat = '12h' | '24h';
export const TIME_FORMATS: readonly TimeFormat[] = ['12h', '24h'];

/** Primeiro dia da semana em calendários/relatórios. */
export type WeekStart = 'sunday' | 'monday';
export const WEEK_STARTS: readonly WeekStart[] = ['sunday', 'monday'];

/**
 * Preferências de experiência do usuário. Todas têm default; o servidor é a
 * fonte de verdade sincronizada, com fallback local (client-first).
 */
export interface UserSettings {
  theme: UiTheme;
  locale: UiLocale;
  /** Desativa animações/transições (também respeita prefers-reduced-motion). */
  reducedMotion: boolean;
  /** Espaçamentos reduzidos no layout. */
  compact: boolean;
  /** Densidade de listas/tabelas. */
  density: UiDensity;
  timeFormat: TimeFormat;
  weekStart: WeekStart;
}

/** Patch parcial — atualiza apenas as chaves enviadas (merge no servidor). */
export type UpdateUserSettingsRequest = Partial<UserSettings>;

/** Valores padrão aplicados quando o usuário nunca configurou. */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  locale: 'pt-BR',
  reducedMotion: false,
  compact: false,
  density: 'comfortable',
  timeFormat: '24h',
  weekStart: 'monday',
};
