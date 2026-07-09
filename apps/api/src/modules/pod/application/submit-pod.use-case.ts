import { Inject, Injectable } from '@nestjs/common';
import type { CreatePodRequest, ProofOfDeliveryView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { outcomeToDeliveryStatus, type ProofOfDelivery } from '../domain/proof-of-delivery';
import {
  DELIVERY_OUTCOME,
  POD_REPOSITORY,
  type DeliveryOutcomePort,
  type PodRepositoryPort,
} from '../domain/ports/pod-repository.port';
import { toPodView } from './pod.mapper';

export interface SubmitPodCommand extends CreatePodRequest {
  tenantId: string;
  /** Motorista que registra o comprovante = usuário autenticado. */
  driverId: string;
}

const MAX_DATA_URL = 4_000_000; // ~4 MB de data URL por mídia (guardrail)

/** Registra o comprovante e aplica o desfecho na entrega (mesma transação). */
@Injectable()
export class SubmitPodUseCase {
  constructor(
    @Inject(POD_REPOSITORY) private readonly repo: PodRepositoryPort,
    @Inject(DELIVERY_OUTCOME) private readonly delivery: DeliveryOutcomePort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: SubmitPodCommand): Promise<ProofOfDeliveryView> {
    const { photo, signature } = command;
    if ((photo && photo.length > MAX_DATA_URL) || (signature && signature.length > MAX_DATA_URL)) {
      throw new ValidationError('Mídia do comprovante excede o tamanho máximo.');
    }
    if (command.status === 'delivered' && !photo && !signature) {
      throw new ValidationError('Comprovante de entrega requer foto ou assinatura.');
    }

    const existing = await this.repo.findByDelivery(command.tenantId, command.deliveryId);
    if (existing) {
      throw new ConflictError('Esta entrega já possui um comprovante.');
    }

    // Aplica o desfecho na entrega (respeita a máquina de estados).
    await this.delivery.markOutcome({
      tenantId: command.tenantId,
      actorId: command.driverId,
      deliveryId: command.deliveryId,
      status: outcomeToDeliveryStatus(command.status),
    });

    const pod: ProofOfDelivery = {
      id: newId(),
      tenantId: command.tenantId,
      deliveryId: command.deliveryId,
      driverId: command.driverId,
      status: command.status,
      note: command.note ?? null,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      photo: photo ?? null,
      signature: signature ?? null,
      recordedAt: new Date(),
    };
    await this.repo.save(pod);

    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.driverId,
      action: 'pod.submitted',
      resource: `delivery:${command.deliveryId}`,
      metadata: { status: command.status, hasPhoto: Boolean(photo), hasSignature: Boolean(signature) },
    });

    return toPodView(pod);
  }
}
