/**
 * Porta do "key ring" de assinatura de tokens. Abstrai a origem das chaves para
 * que a implementação local (chaves em memória/PEM) possa ser trocada por um
 * KMS/HSM no futuro sem alterar o serviço de tokens (ver ADR de RS256).
 */
export interface SigningKey {
  kid: string;
  privateKey: string;
}

export interface KeyRingPort {
  /** Chave ativa para assinatura (a mais recente). */
  getSigningKey(): SigningKey;
  /** Chave pública para verificação, selecionada pelo `kid` do token. */
  getPublicKey(kid: string): string | null;
}

export const KEY_RING = Symbol('KEY_RING');
