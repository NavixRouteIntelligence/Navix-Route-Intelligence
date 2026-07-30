/**
 * Convite resolvido a partir do token. É o **único** lugar de onde o tenant de
 * um request público pode sair — nunca do corpo nem do cabeçalho.
 */
export interface DriverInviteRef {
  tenantId: string;
  /** Nome da organização, para o convidado reconhecer quem o convidou. */
  organizationName: string;
  /** E-mail convidado. Vira o login; o convidado não escolhe outro. */
  email: string;
  /** Ficha a ligar no aceite. `null` = a ficha é criada no aceite. */
  driverId: string | null;
}

export interface NewDriverInvite {
  token: string;
  tenantId: string;
  email: string;
  driverId: string | null;
  invitedBy: string;
  expiresAt: Date;
}

/**
 * Port dos convites de motorista (ADR-0085).
 *
 * `resolve` e `claim` **não são escopados por tenant**: são eles que descobrem
 * o tenant, a partir de um request sem autenticação. É o mesmo desenho dos
 * tokens públicos de rastreio (ADR-0082), com uma diferença que a migração
 * documenta: esta tabela guarda PII (e-mail), então a leitura sempre parte do
 * token — nunca do e-mail — e o token é de uso único.
 */
export interface DriverInviteRepositoryPort {
  /** Convite vigente (não aceito, não revogado, não expirado). `null` caso contrário. */
  resolve(token: string): Promise<DriverInviteRef | null>;

  /**
   * Marca o convite como aceito **e** devolve o vínculo, numa única instrução.
   * Atômico por construção: um segundo aceite concorrente não casa mais o
   * `accepted_at IS NULL` e recebe `null`, em vez de criar um segundo login.
   */
  claim(token: string): Promise<DriverInviteRef | null>;

  /** Revoga os convites pendentes daquele e-mail no tenant (reconvidar substitui). */
  revokePending(tenantId: string, email: string): Promise<void>;

  create(invite: NewDriverInvite): Promise<void>;
}

export const DRIVER_INVITE_REPOSITORY = Symbol('DRIVER_INVITE_REPOSITORY');
