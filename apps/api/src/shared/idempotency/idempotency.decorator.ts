import { SetMetadata } from '@nestjs/common';

/** Chave de metadata que marca um handler como idempotente. */
export const IDEMPOTENT_KEY = 'navix:idempotent';

/**
 * Marca um endpoint como **idempotente**: quando o cliente envia o header
 * `Idempotency-Key`, o `IdempotencyInterceptor` deduplica reenvios (replica a
 * resposta da primeira execução). Sem o header, o comportamento é o normal.
 * Ver ADR-0017.
 */
export const Idempotent = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IDEMPOTENT_KEY, true);
