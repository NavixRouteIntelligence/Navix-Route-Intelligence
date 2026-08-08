import type { AccountType } from '@navix/contracts';

/**
 * Tipo de conta do tenant (`driver` | `company`), isolado da regra que o usa.
 *
 * Existe porque "o tenant é uma pessoa só" é uma afirmação que precisa de ser
 * **verificada**, não presumida. A ADR-0097 presumia-a a partir de "o login não
 * tem ficha", e as duas coisas não coincidem: um motorista de frota cuja ficha
 * nunca foi ligada não tem ficha e o tenant dele tem mais gente (ADR-0116).
 */
export interface TenantAccountTypeReaderPort {
  findAccountType(tenantId: string): Promise<AccountType>;
}

export const TENANT_ACCOUNT_TYPE_READER = Symbol('TENANT_ACCOUNT_TYPE_READER');

/**
 * Padrão quando não se consegue ler: **`company`**, e não `driver`.
 *
 * É o inverso do default do fuso, de propósito. Lá, errar devolve `UTC` e
 * degrada o dia; aqui, errar para `driver` faria o rollup do tenant passar por
 * desempenho pessoal — exatamente o vazamento que esta porta fecha. Falhar
 * fechado significa mostrar menos, nunca o de outra pessoa.
 */
export const DEFAULT_ACCOUNT_TYPE: AccountType = 'company';
