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

/** Resposta do cadastro: já autentica (mesmo shape do login) + tipo de conta. */
export interface RegisterResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
  accountType: AccountType;
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
