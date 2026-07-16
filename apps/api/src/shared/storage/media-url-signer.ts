import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

let processSecret: string | undefined;

/**
 * Resolve o segredo de assinatura de URLs de mídia (ADR-0046). Usa o segredo
 * configurado (estável entre instâncias em produção) ou, na ausência, um segredo
 * **aleatório por processo** — suficiente para dev single-instance; em produção
 * multi-instância o segredo deve ser configurado (`MEDIA_URL_SECRET`).
 */
export function resolveMediaSecret(configured?: string): string {
  if (configured && configured.length > 0) return configured;
  processSecret ??= randomBytes(32).toString('base64url');
  return processSecret;
}

/**
 * Assina/verifica URLs de mídia de PII (POD) com HMAC + expiração — evita URLs
 * públicas permanentes (auditoria de segurança S5). A assinatura é gerada no
 * **read** (expiração curta a cada acesso), então o comprovante continua
 * acessível indefinidamente, mas cada link expira.
 */
export class MediaUrlSigner {
  constructor(
    private readonly secret: string,
    private readonly ttlSeconds: number,
  ) {}

  /** Parâmetros de query para uma chave: `exp` (epoch s) + `sig`. */
  sign(key: string, now: number = Date.now()): { exp: number; sig: string } {
    const exp = Math.floor(now / 1000) + this.ttlSeconds;
    return { exp, sig: this.hmac(key, exp) };
  }

  verify(key: string, exp: number, sig: string, now: number = Date.now()): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < now) return false;
    const expected = Buffer.from(this.hmac(key, exp));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private hmac(key: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${key}:${exp}`).digest('base64url');
  }
}
