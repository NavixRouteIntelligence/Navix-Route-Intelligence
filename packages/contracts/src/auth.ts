/**
 * Contratos de autenticação compartilhados entre backend e frontend.
 * Ver docs/security.md (JWT + Refresh Token).
 */

/**
 * Tipo de conta escolhido na criação. Determina a organização, os papéis (RBAC)
 * e o destino pós-cadastro. `driver` (Motorista Autônomo) nasce com organização
 * pessoal e pode futuramente migrar para `company` sem perda de dados.
 */
export type AccountType = 'driver' | 'company';

/** Papéis conhecidos usados para adaptar a interface (RBAC). */
export type KnownRole = 'admin' | 'dispatcher' | 'fleet_manager' | 'driver';

/** Corpo da requisição de login. */
export interface LoginRequest {
  /**
   * Tenant alvo. Enviado explicitamente nesta fase; pode evoluir para
   * resolução por subdomínio/host (ver docs/architecture.md §6).
   */
  tenantId: string;
  email: string;
  password: string;
}

/** Criação de conta. Empresa exige `organizationName`; autônomo o deriva do nome. */
export interface RegisterRequest {
  accountType: AccountType;
  /** Nome da pessoa (responsável / motorista principal). */
  name: string;
  email: string;
  password: string;
  /** Nome da organização — obrigatório para `company`. */
  organizationName?: string;
}

/** Representação pública e segura do usuário autenticado (sem dados sensíveis). */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
}

// ===========================================================================
// Tokens
// ===========================================================================

/** Access token entregue no corpo da resposta (comum a web e mobile). */
export interface AccessToken {
  accessToken: string;
  /** Segundos até a expiração do access token. */
  expiresIn: number;
}

/**
 * Conjunto completo de tokens — inclui o **refresh token no corpo**. É a resposta
 * dos endpoints **mobile** (`/auth/mobile/*`), que operam em modo *bearer* e
 * guardam o refresh token em armazenamento seguro do dispositivo.
 */
export interface SessionTokens extends AccessToken {
  refreshToken: string;
}

// ===========================================================================
// Camada de aplicação (client-agnostic) — SEMPRE contém o refresh token.
// Cada controller mapeia este resultado para o contrato do seu cliente.
// ===========================================================================

/** Resultado de autenticação da aplicação (login/refresh). */
export interface AuthResult {
  user: AuthenticatedUser;
  tokens: SessionTokens;
}

/** Resultado de cadastro da aplicação (login + tipo de conta). */
export interface AuthResultWithAccount extends AuthResult {
  accountType: AccountType;
}

// ===========================================================================
// WEB — autenticação por COOKIE HttpOnly. O corpo NUNCA traz o refresh token
// (ele vai no cookie `Set-Cookie`, inacessível a JavaScript). Rotas: /auth/*.
// ===========================================================================

/** Resposta de login web: usuário + apenas o access token no corpo. */
export interface WebAuthResponse {
  user: AuthenticatedUser;
  tokens: AccessToken;
}

/** Resposta de cadastro web (+ tipo de conta). */
export interface WebRegisterResponse extends WebAuthResponse {
  accountType: AccountType;
}

// ===========================================================================
// MOBILE — autenticação por BEARER TOKEN. Rotas dedicadas: /auth/mobile/*.
// O refresh token trafega no corpo (request e response); não há cookie nem
// dependência de header algum (ex.: o antigo `X-Auth-Mode`). Ver ADR-0015.
// ===========================================================================

/** Resposta de login mobile: usuário + tokens completos (com refresh token). */
export interface MobileAuthResponse {
  user: AuthenticatedUser;
  tokens: SessionTokens;
}

/** Resposta de cadastro mobile (+ tipo de conta). */
export interface MobileRegisterResponse extends MobileAuthResponse {
  accountType: AccountType;
}

/** Corpo do refresh mobile: o refresh token é **obrigatório**. */
export interface MobileRefreshRequest {
  refreshToken: string;
}

/** Corpo do logout mobile: revoga o refresh token apresentado. */
export interface MobileLogoutRequest {
  refreshToken: string;
}

/** Claims mínimas carregadas no access token (payload do JWT). */
export interface AccessTokenClaims {
  /** subject = user id */
  sub: string;
  tenantId: string;
  roles: string[];
}

/** Troca de senha do usuário autenticado. */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/** Solicitação de recuperação de senha. */
export interface ForgotPasswordRequest {
  tenantId: string;
  email: string;
}

/**
 * Resposta do "esqueci a senha". Em desenvolvimento, `resetToken` é retornado
 * para permitir concluir o fluxo sem e-mail; em produção seria enviado por e-mail.
 */
export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
}

/** Confirmação de redefinição de senha. */
export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/**
 * Perfil do usuário (dados de identificação exibíveis). Distinto de
 * `AuthenticatedUser` (identidade/segurança) — ver docs/modules/settings.md §3.1.
 */
export interface UserProfile {
  /** Nome de exibição. */
  displayName: string;
  /** Telefone em formato E.164 (ex.: +5511999998888) ou nulo. */
  phone: string | null;
  /** Cargo/função (rótulo livre) ou nulo. */
  jobTitle: string | null;
  /** Fuso horário IANA (ex.: America/Sao_Paulo). */
  timeZone: string;
  /** Avatar como data URL (image/*) ou nulo. */
  avatarUrl: string | null;
}

/** Atualização parcial do perfil. `null` limpa o campo; ausência preserva. */
export interface UpdateProfileRequest {
  displayName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  timeZone?: string;
}

/** Define o avatar do usuário (data URL de imagem). */
export interface UpdateAvatarRequest {
  /** Data URL `data:image/...;base64,...`. */
  avatar: string;
}
