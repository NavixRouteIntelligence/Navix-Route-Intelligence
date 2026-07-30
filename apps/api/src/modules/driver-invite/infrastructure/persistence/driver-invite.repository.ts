import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { scopedRepository } from '../../../../shared/database/transaction-context';
import type {
  DriverInviteRef,
  DriverInviteRepositoryPort,
  NewDriverInvite,
} from '../../domain/ports/driver-invite-repository.port';
import { DriverInviteOrmEntity } from './driver-invite.orm-entity';

/** Linha crua do join com `tenants` (a organização que convidou). */
interface InviteRow {
  tenant_id: string;
  organization_name: string;
  email: string;
  driver_id: string | null;
}

/**
 * Normaliza o retorno cru do TypeORM: um `SELECT` devolve as linhas, mas um
 * `UPDATE ... RETURNING` devolve `[linhas, afetadas]`. A diferença é traiçoeira
 * — `raw[0]` no segundo caso é um **array**, que é truthy e não tem nenhum dos
 * campos, então o convite parecia resolvido com tenant `undefined`.
 */
function rowsOf(raw: unknown): InviteRow[] {
  const first = Array.isArray(raw) ? (raw as unknown[])[0] : undefined;
  return (Array.isArray(first) ? first : raw) as InviteRow[];
}

function toRef(row: InviteRow | undefined): DriverInviteRef | null {
  return row
    ? {
        tenantId: row.tenant_id,
        organizationName: row.organization_name,
        email: row.email,
        driverId: row.driver_id,
      }
    : null;
}

/**
 * Repositório dos convites (ADR-0085).
 *
 * `resolve` roda **fora** de transação de tenant — o convidado ainda não tem
 * conta, então não há `app.current_tenant` e é esta consulta que o descobre. O
 * `scopedRepository` cai no pool padrão nesse caso; a tabela não tem RLS
 * justamente por ser o ponto de entrada público (ver a migração).
 *
 * `claim`, ao contrário, é chamado **dentro** da transação já aberta com o
 * tenant do token, para que marcar o convite como aceito e criar a conta sejam
 * atômicos: se a criação falhar, o convite volta a valer.
 */
@Injectable()
export class DriverInviteRepository implements DriverInviteRepositoryPort {
  constructor(
    @InjectRepository(DriverInviteOrmEntity)
    private readonly base: Repository<DriverInviteOrmEntity>,
  ) {}

  async resolve(token: string): Promise<DriverInviteRef | null> {
    const raw: unknown = await this.base.query(
      `SELECT i.tenant_id, t.name AS organization_name, i.email, i.driver_id
         FROM driver_invites i
         JOIN tenants t ON t.id = i.tenant_id
        WHERE i.token = $1
          AND i.accepted_at IS NULL
          AND i.revoked_at IS NULL
          AND i.expires_at > now()`,
      [token],
    );
    return toRef(rowsOf(raw)[0]);
  }

  async claim(token: string): Promise<DriverInviteRef | null> {
    // Marcar e ler numa instrução só: o `accepted_at IS NULL` no WHERE é o que
    // impede dois aceites simultâneos de criarem dois logins para um convite.
    const raw: unknown = await scopedRepository(this.base).query(
      `UPDATE driver_invites i
          SET accepted_at = now()
         FROM tenants t
        WHERE i.token = $1
          AND t.id = i.tenant_id
          AND i.accepted_at IS NULL
          AND i.revoked_at IS NULL
          AND i.expires_at > now()
      RETURNING i.tenant_id, t.name AS organization_name, i.email, i.driver_id`,
      [token],
    );
    return toRef(rowsOf(raw)[0]);
  }

  async revokePending(tenantId: string, email: string): Promise<void> {
    // Reconvidar substitui o convite anterior — é também o que libera o índice
    // único parcial de "um convite pendente por e-mail no tenant".
    await scopedRepository(this.base).query(
      `UPDATE driver_invites
          SET revoked_at = now()
        WHERE tenant_id = $1
          AND lower(email) = lower($2)
          AND accepted_at IS NULL
          AND revoked_at IS NULL`,
      [tenantId, email],
    );
  }

  async create(invite: NewDriverInvite): Promise<void> {
    await scopedRepository(this.base).insert({
      token: invite.token,
      tenantId: invite.tenantId,
      email: invite.email,
      driverId: invite.driverId,
      invitedBy: invite.invitedBy,
      expiresAt: invite.expiresAt,
      acceptedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });
  }
}
