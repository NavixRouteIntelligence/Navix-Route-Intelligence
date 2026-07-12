import type { Request, Response } from 'express';

import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  clearRefreshCookie,
  isBearerMode,
  readRefreshCookie,
  resolveRefreshToken,
  setRefreshCookie,
  type RefreshCookieConfig,
} from './auth-cookie';

const config: RefreshCookieConfig = { secure: true, sameSite: 'lax', maxAgeSeconds: 1209600 };

function req(headers: Record<string, string | string[] | undefined>): Request {
  return { headers } as unknown as Request;
}

describe('auth-cookie', () => {
  describe('readRefreshCookie', () => {
    it('extrai o refresh token do header Cookie', () => {
      const r = req({ cookie: `${REFRESH_COOKIE_NAME}=abc.def; other=1` });
      expect(readRefreshCookie(r)).toBe('abc.def');
    });

    it('retorna null quando não há cookie', () => {
      expect(readRefreshCookie(req({}))).toBeNull();
    });

    it('retorna null quando o cookie de refresh não está presente', () => {
      expect(readRefreshCookie(req({ cookie: 'foo=bar; baz=qux' }))).toBeNull();
    });

    it('decodifica valores percent-encoded', () => {
      const r = req({ cookie: `${REFRESH_COOKIE_NAME}=a%20b` });
      expect(readRefreshCookie(r)).toBe('a b');
    });
  });

  describe('isBearerMode', () => {
    it('true quando X-Auth-Mode: bearer (case-insensitive)', () => {
      expect(isBearerMode(req({ 'x-auth-mode': 'bearer' }))).toBe(true);
      expect(isBearerMode(req({ 'x-auth-mode': 'Bearer' }))).toBe(true);
    });

    it('false quando ausente ou diferente (fluxo web/cookie)', () => {
      expect(isBearerMode(req({}))).toBe(false);
      expect(isBearerMode(req({ 'x-auth-mode': 'cookie' }))).toBe(false);
    });
  });

  describe('resolveRefreshToken', () => {
    it('prioriza o cookie sobre o corpo', () => {
      const r = req({ cookie: `${REFRESH_COOKIE_NAME}=from-cookie` });
      expect(resolveRefreshToken(r, 'from-body')).toBe('from-cookie');
    });

    it('cai para o corpo quando não há cookie (modo bearer)', () => {
      expect(resolveRefreshToken(req({}), 'from-body')).toBe('from-body');
    });

    it('retorna null quando não há nem cookie nem corpo', () => {
      expect(resolveRefreshToken(req({}), undefined)).toBeNull();
    });
  });

  describe('setRefreshCookie / clearRefreshCookie', () => {
    it('define o cookie HttpOnly com os atributos corretos', () => {
      const cookie = jest.fn();
      const res = { cookie } as unknown as Response;
      setRefreshCookie(res, 'the-token', config);
      expect(cookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        'the-token',
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: REFRESH_COOKIE_PATH,
          maxAge: 1209600 * 1000,
        }),
      );
    });

    it('limpa o cookie com path/atributos casados', () => {
      const clearCookie = jest.fn();
      const res = { clearCookie } as unknown as Response;
      clearRefreshCookie(res, config);
      expect(clearCookie).toHaveBeenCalledWith(
        REFRESH_COOKIE_NAME,
        expect.objectContaining({ httpOnly: true, path: REFRESH_COOKIE_PATH }),
      );
    });
  });
});
