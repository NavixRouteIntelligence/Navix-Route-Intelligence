import type { Request, Response } from 'express';

import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  clearRefreshCookie,
  readRefreshCookie,
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
