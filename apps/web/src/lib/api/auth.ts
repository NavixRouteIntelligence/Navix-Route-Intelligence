import type {
  AccessToken,
  AuthenticatedUser,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  ResourceResponse,
  WebAuthResponse,
  WebRegisterResponse,
} from '@navix/contracts';

import { apiRequest } from './client';

// Cliente WEB: autenticação por cookie HttpOnly (endpoints /auth/*). O refresh
// token nunca aparece no corpo — o navegador envia/recebe o cookie. Clientes
// nativos usam /auth/mobile/* (ver ADR-0015).
export const authApi = {
  login: (payload: LoginRequest) =>
    apiRequest<WebAuthResponse>('/auth/login', { method: 'POST', body: payload, auth: false }),

  register: (payload: RegisterRequest) =>
    apiRequest<WebRegisterResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),

  // O refresh token viaja no cookie HttpOnly; o corpo vai vazio (fluxo web).
  refresh: () =>
    apiRequest<AccessToken>('/auth/refresh', { method: 'POST', auth: false }),

  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', auth: false }),

  me: () => apiRequest<ResourceResponse<AuthenticatedUser>>('/auth/me'),

  changePassword: (payload: ChangePasswordRequest) =>
    apiRequest<void>('/auth/change-password', { method: 'POST', body: payload }),

  forgotPassword: (payload: ForgotPasswordRequest) =>
    apiRequest<ForgotPasswordResponse>('/auth/forgot-password', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  resetPassword: (payload: ResetPasswordRequest) =>
    apiRequest<void>('/auth/reset-password', { method: 'POST', body: payload, auth: false }),
};
