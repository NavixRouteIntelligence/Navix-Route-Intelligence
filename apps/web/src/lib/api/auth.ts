import type {
  AuthenticatedUser,
  AuthTokens,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
  ResourceResponse,
} from '@navix/contracts';

import { apiRequest } from './client';

export const authApi = {
  login: (payload: LoginRequest) =>
    apiRequest<LoginResponse>('/auth/login', { method: 'POST', body: payload, auth: false }),

  register: (payload: RegisterRequest) =>
    apiRequest<RegisterResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),

  refresh: (refreshToken: string) =>
    apiRequest<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    apiRequest<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),

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
