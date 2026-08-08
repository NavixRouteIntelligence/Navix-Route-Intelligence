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
  // Fila durável (ADR-0114). Estava ausente deste fixture, e o fixture chamava
  // a si mesmo de "produção corretamente configurada" — que é exatamente o
  // ponto cego que a regra fecha.
  OPTIMIZER_QUEUE_DRIVER: 'bullmq',
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

  it('valida os limites da automação de geofence', () => {
    const env = validateEnv(baseEnv);
    expect(env.TRACKING_GEOFENCE_AUTOMATION_ENABLED).toBe(true);
    expect(env.TRACKING_GEOFENCE_DWELL_MINUTES).toBe(2);
    expect(env.TRACKING_GEOFENCE_CHECK_INTERVAL_MS).toBe(30_000);
    expect(() => validateEnv({ ...baseEnv, TRACKING_GEOFENCE_CHECK_INTERVAL_MS: '1000' })).toThrow(
      /Configuração de ambiente inválida/,
    );
  });

  // NAV-4.14 / ADR-0114: o fallback local é legítimo em desenvolvimento e teste,
  // e inaceitável em produção — onde ele não falha nem avisa.
  it('recusa produção com a fila in-process (o default silencioso)', () => {
    expect(() => validateEnv({ ...prodEnv, OPTIMIZER_QUEUE_DRIVER: 'inprocess' })).toThrow(
      /OPTIMIZER_QUEUE_DRIVER/,
    );
  });

  it('recusa produção quando a variável é simplesmente esquecida', () => {
    const { OPTIMIZER_QUEUE_DRIVER: _omitida, ...semFila } = prodEnv;

    // É este o caso real: ninguém escreve `inprocess`, apenas não escreve nada.
    expect(() => validateEnv(semFila)).toThrow(/OPTIMIZER_QUEUE_DRIVER.*bullmq/s);
  });

  it('a mensagem diz o que se perde, não só o que está errado', () => {
    let mensagem = '';
    try {
      validateEnv({ ...prodEnv, OPTIMIZER_QUEUE_DRIVER: 'inprocess' });
    } catch (err) {
      mensagem = err instanceof Error ? err.message : String(err);
    }

    expect(mensagem).toMatch(/durabilidade|reinício/);
  });

  it('fora de produção, a fila in-process continua sendo o default', () => {
    const env = validateEnv(baseEnv);

    expect(env.NODE_ENV).toBe('development');
    expect(env.OPTIMIZER_QUEUE_DRIVER).toBe('inprocess');
  });

  it('teste também roda com a fila in-process, sem exigir Redis', () => {
    const env = validateEnv({ ...baseEnv, NODE_ENV: 'test' });

    expect(env.OPTIMIZER_QUEUE_DRIVER).toBe('inprocess');
  });
});
