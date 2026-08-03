import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { NotFoundError } from '../../../shared/kernel/domain-error';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';
import { CreateDeliveryUseCase } from './create-delivery.use-case';
import { UpdateDeliveryUseCase } from './update-delivery.use-case';

/** Rascunho de entrega vindo de outra origem (ex.: Import Center). */
export interface DeliveryDraft {
  tenantId: string;
  actorId: string;
  street: string;
  number: string;
  complement: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  notes: string | null;
  /**
   * Destinatário e contato. **Estavam sendo perdidos aqui:** a ADR-0076 levou o
   * `recipient` até este port, mas o `create` abaixo montava o objeto do caso de
   * uso sem ele — o nome vindo da importação nunca chegava ao banco. O e-mail e
   * o telefone (ADR-0084) entram pelo mesmo caminho.
   */
  recipient?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  timeWindow?: { start: string; end: string };
}

/** Desfecho de uma entrega (usado pelo Proof of Delivery). */
export interface DeliveryOutcomeInput {
  tenantId: string;
  actorId: string;
  deliveryId: string;
  status: 'delivered' | 'failed';
}

/** Atribuição de uma entrega a uma ficha de motorista (ADR-0101). */
export interface DeliveryAssignmentInput {
  tenantId: string;
  actorId: string;
  deliveryId: string;
  /** Ficha (`drivers.id`), nunca o login — ADR-0086. */
  driverId: string;
}

/** API pública de escrita do contexto Delivery. */
export interface DeliveryWriterPort {
  create(draft: DeliveryDraft): Promise<string>;
  /** Registra o desfecho, respeitando a máquina de estados (passa por in_route). */
  markOutcome(input: DeliveryOutcomeInput): Promise<void>;
  /**
   * Dá dono a uma entrega **sem motorista**. Devolve `false` — sem lançar —
   * quando ela já tem um: distribuir é uma operação em lote, e perder a corrida
   * para uma atribuição manual é desfecho normal, não erro (ADR-0101).
   */
  assignDriver(input: DeliveryAssignmentInput): Promise<boolean>;
}

export const DELIVERY_WRITER = Symbol('DELIVERY_WRITER');

const DEFAULT_WINDOW_HOURS = 8;

@Injectable()
export class DeliveryWriterService implements DeliveryWriterPort {
  constructor(
    private readonly createDelivery: CreateDeliveryUseCase,
    private readonly updateDelivery: UpdateDeliveryUseCase,
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  /**
   * Delega ao `UpdateDeliveryUseCase` — o mesmo caminho do `PATCH` manual — em
   * vez de gravar aqui. Assim uma entrega atribuída pela distribuição fica
   * **indistinguível** de uma atribuída à mão: mesma validação de existência da
   * ficha, mesma auditoria, mesmo `delivery.updated` interno e no outbox de
   * webhooks. Repetir a gravação aqui criaria um segundo caminho de escrita
   * para o mesmo campo, que é como as duas metades saem de sincronia.
   */
  async assignDriver(input: DeliveryAssignmentInput): Promise<boolean> {
    const delivery = await this.deliveries.findById(input.tenantId, input.deliveryId);
    if (!delivery) throw new NotFoundError('Entrega não encontrada.');

    // Relê o dono agora, e não no lote: entre montar a distribuição e gravá-la,
    // um despachante pode ter atribuído esta entrega à mão. Quem chegou
    // primeiro vence, e a distribuição não desfaz decisão de gente.
    if (delivery.snapshot().driverId !== null) return false;

    await this.updateDelivery.execute({
      tenantId: input.tenantId,
      id: input.deliveryId,
      actorId: input.actorId,
      driverId: input.driverId,
    });
    return true;
  }

  async markOutcome(input: DeliveryOutcomeInput): Promise<void> {
    const delivery = await this.deliveries.findById(input.tenantId, input.deliveryId);
    if (!delivery) {
      throw new NotFoundError('Entrega não encontrada.');
    }
    const from = delivery.status;
    if (from === input.status) return;

    // Máquina de estados: o desfecho final vem de `in_route`.
    if (delivery.status === 'pending' || delivery.status === 'failed') {
      delivery.changeStatus('in_route');
    }
    delivery.changeStatus(input.status);
    await this.deliveries.save(delivery);

    await this.audit.record({
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: 'delivery.outcome',
      resource: `delivery:${input.deliveryId}`,
      metadata: { from, to: input.status },
    });
  }

  async create(draft: DeliveryDraft): Promise<string> {
    const now = Date.now();
    const timeWindow =
      draft.timeWindow ?? {
        start: new Date(now).toISOString(),
        end: new Date(now + DEFAULT_WINDOW_HOURS * 3_600_000).toISOString(),
      };

    const view = await this.createDelivery.execute({
      tenantId: draft.tenantId,
      actorId: draft.actorId,
      address: {
        street: draft.street,
        number: draft.number,
        complement: draft.complement,
        city: draft.city,
        state: draft.state,
        postalCode: draft.postalCode,
        country: draft.country,
        latitude: draft.latitude,
        longitude: draft.longitude,
      },
      priority: draft.priority,
      timeWindow,
      notes: draft.notes,
      recipient: draft.recipient ?? null,
      recipientEmail: draft.recipientEmail ?? null,
      recipientPhone: draft.recipientPhone ?? null,
    });
    return view.id;
  }
}
