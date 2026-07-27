import { Inject, Injectable } from '@nestjs/common';
import type { DriverInvitePreview } from '@navix/contracts';

import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DRIVER_INVITE_REPOSITORY,
  type DriverInviteRepositoryPort,
} from '../domain/ports/driver-invite-repository.port';

/**
 * Valida o token e devolve o mínimo para a página pública do convite
 * (ADR-0085). Não abre transação de tenant porque não lê dado de negócio: só o
 * convite e o nome da organização, ambos fora da RLS.
 *
 * Resposta **idêntica** para token inexistente, expirado, revogado ou já
 * aceito — distinguir os casos confirmaria a existência de um token a quem
 * estivesse sondando (mesma regra do rastreio público, ADR-0082).
 */
@Injectable()
export class ValidateDriverInviteUseCase {
  constructor(
    @Inject(DRIVER_INVITE_REPOSITORY) private readonly invites: DriverInviteRepositoryPort,
  ) {}

  async execute(token: string): Promise<DriverInvitePreview> {
    const invite = await this.invites.resolve(token);
    if (!invite) throw new NotFoundError('Convite inválido ou expirado.');

    return {
      email: invite.email,
      organizationName: invite.organizationName,
      requiresDriverDetails: invite.driverId === null,
    };
  }
}
