import { DEV_APP_PASSWORD, validateEnv } from './env.schema';

/** Env mínimo válido; os testes sobrescrevem só o que interessa. */
const baseEnv = {
  DB_HOST: 'localhost',
  DB_USER: 'navix',
  DB_PASSWORD: 'navix_password',
  DB_NAME: 'navix',
  REDIS_HOST: 'localhost',
  ENCRYPTION_KEK: 'kek-de-testes-1234567890',
};

/** Env de produção completo e correto (o "caminho feliz" do deploy). */
const prodEnv = {
  ...baseEnv,
  NODE_ENV: 'production',
  DB_SSL: 'true',
  DB_APP_PASSWORD: 'senha-forte-de-producao',
  JWT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----fake-----END PRIVATE KEY-----',
  JWT_PUBLIC_KEY: '-----BEGIN PUBLIC KEY-----fake-----END PUBLIC KEY-----',
  JWT_KEY_ID: 'kid-1',
  MEDIA_URL_SECRET: 'segredo-de-midia-estavel',
};

describe('validateEnv — guarda de produção (ADR-0052)', () => {
  it('aceita dev sem JWT/mídia/SSL (fallbacks continuam válidos fora de produção)', () => {
    const env = validateEnv(baseEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.JWT_PRIVATE_KEY).toBeUndefined();
    expect(env.MEDIA_URL_SECRET).toBeUndefined();
    expect(env.DB_APP_PASSWORD).toBe(DEV_APP_PASSWORD);
  });

  it('aceita produção corretamente configurada', () => {
    expect(() => validateEnv(prodEnv)).not.toThrow();
  });

  it.each([
    ['JWT_PRIVATE_KEY', 'JWT_PRIVATE_KEY'],
    ['JWT_PUBLIC_KEY', 'JWT_PUBLIC_KEY'],
    ['JWT_KEY_ID', 'JWT_KEY_ID'],
    ['MEDIA_URL_SECRET', 'MEDIA_URL_SECRET'],
  ])('derruba o boot em produção sem %s', (key, expected) => {
    const env = { ...prodEnv };
    delete (env as Record<string, unknown>)[key];

    expect(() => validateEnv(env)).toThrow(expected);
  });

  it('derruba o boot em produção com a senha padrão do role de runtime', () => {
    expect(() => validateEnv({ ...prodEnv, DB_APP_PASSWORD: DEV_APP_PASSWORD })).toThrow(
      /DB_APP_PASSWORD.*senha padrão/s,
    );
  });

  it('derruba o boot em produção sem TLS no banco', () => {
    expect(() => validateEnv({ ...prodEnv, DB_SSL: 'false' })).toThrow(/DB_SSL/);
  });

  it('reporta todos os problemas de uma vez (não só o primeiro)', () => {
    const env = { ...prodEnv, DB_SSL: 'false', DB_APP_PASSWORD: DEV_APP_PASSWORD };
    delete (env as Record<string, unknown>).JWT_PRIVATE_KEY;
    delete (env as Record<string, unknown>).MEDIA_URL_SECRET;

    // Um deploy quebrado deve mostrar a lista inteira, não uma falha por vez.
    expect(() => validateEnv(env)).toThrow(
      /JWT_PRIVATE_KEY[\s\S]*MEDIA_URL_SECRET[\s\S]*DB_APP_PASSWORD[\s\S]*DB_SSL/,
    );
  });

  it('mantém a validação de schema (env inválido continua falhando)', () => {
    expect(() => validateEnv({ ...baseEnv, ENCRYPTION_KEK: 'curta' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });
});
