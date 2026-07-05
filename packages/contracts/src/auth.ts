/**
 * Contratos de autenticação compartilhados entre backend e frontend.
 * Ver docs/security.md (JWT + Refresh Token).
 */

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

/** Corpo da requisição de refresh de token. */
export interface RefreshRequest {
  refreshToken: string;
}

/** Par de tokens retornado no login/refresh. */
export interface AuthTokens {
  accessToken: string;
  /** Segundos até a expiração do access token. */
  expiresIn: number;
  refreshToken: string;
}

/** Representação pública e segura do usuário autenticado (sem dados sensíveis). */
export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  roles: string[];
}

/** Resposta do login: usuário + tokens. */
export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

/** Claims mínimas carregadas no access token (payload do JWT). */
export interface AccessTokenClaims {
  /** subject = user id */
  sub: string;
  tenantId: string;
  roles: string[];
}
