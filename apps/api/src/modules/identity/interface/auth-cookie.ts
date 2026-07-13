import type { Request, Response } from 'express';

/**
 * Entrega e leitura do **refresh token** via cookie HttpOnly (padrão de produção
 * para o cliente web — ver docs/security.md §2). O access token continua apenas
 * em memória no cliente; o refresh token nunca é acessível por JavaScript.
 *
 * Atributos do cookie:
 *  - `HttpOnly`  → invisível ao JS (mitiga exfiltração por XSS).
 *  - `Secure`    → só trafega em HTTPS (ligado em produção).
 *  - `SameSite`  → `lax` (web e API compartilham o mesmo site; bloqueia CSRF
 *                  cross-site em navegações). Ajustável por env se web e API
 *                  ficarem em sites distintos (aí exige `none` + `secure`).
 *  - `Path`      → restrito às rotas de auth: o cookie só é enviado para
 *                  `/api/v1/auth/*` (refresh/logout), reduzindo a superfície.
 *  - `Max-Age`   → casado com o TTL do refresh token.
 */
export const REFRESH_COOKIE_NAME = 'navix_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export type SameSiteMode = 'lax' | 'strict' | 'none';

export interface RefreshCookieConfig {
  secure: boolean;
  sameSite: SameSiteMode;
  maxAgeSeconds: number;
}

/** Define o cookie de refresh na resposta. */
export function setRefreshCookie(
  res: Response,
  token: string,
  config: RefreshCookieConfig,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    path: REFRESH_COOKIE_PATH,
    maxAge: config.maxAgeSeconds * 1000,
  });
}

/** Remove o cookie de refresh (logout). Os atributos devem casar com o set. */
export function clearRefreshCookie(res: Response, config: RefreshCookieConfig): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.secure,
    sameSite: config.sameSite,
    path: REFRESH_COOKIE_PATH,
  });
}

/**
 * Lê o refresh token do cookie da requisição, sem depender de `cookie-parser`
 * (o Express não popula `req.cookies` por si só). Parsing tolerante do header
 * `Cookie` seguindo o formato `name=value; name2=value2`.
 */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name === REFRESH_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}
