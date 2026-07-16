import { Inject, Injectable } from '@nestjs/common';
import type { CreatePodRequest, ProofOfDeliveryView } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ConflictError, ValidationError } from '../../../shared/kernel/domain-error';
import { newId } from '../../../shared/kernel/id';
import { decodeDataUrl, isDataUrl } from '../../../shared/storage/data-url';
import { STORAGE, type StoragePort } from '../../../shared/storage/storage.port';
import { outcomeToDeliveryStatus, type ProofOfDelivery } from '../domain/proof-of-delivery';
import {
  DELIVERY_OUTCOME,
  POD_REPOSITORY,
  type DeliveryOutcomePort,
  type PodRepositoryPort,
} from '../domain/ports/pod-repository.port';
import { toPodViewSigned } from './pod.mapper';

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
    @Inject(STORAGE) private readonly storage: StoragePort,
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

    // Mídia fora do Postgres: data URLs são enviadas ao storage; salva-se a URL.
    const podId = newId();
    const photoUrl = await this.offload(command.tenantId, podId, 'photo', photo);
    const signatureUrl = await this.offload(command.tenantId, podId, 'signature', signature);

    // Aplica o desfecho na entrega (respeita a máquina de estados).
    await this.delivery.markOutcome({
      tenantId: command.tenantId,
      actorId: command.driverId,
      deliveryId: command.deliveryId,
      status: outcomeToDeliveryStatus(command.status),
    });

    const pod: ProofOfDelivery = {
      id: podId,
      tenantId: command.tenantId,
      deliveryId: command.deliveryId,
      driverId: command.driverId,
      status: command.status,
      note: command.note ?? null,
      latitude: command.latitude ?? null,
      longitude: command.longitude ?? null,
      photo: photoUrl,
      signature: signatureUrl,
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

    return toPodViewSigned(pod, this.storage);
  }

  /**
   * Move uma mídia para o storage e devolve a URL. Compatibilidade: se o valor
   * já for uma URL (upload direto futuro), passa direto; `null` permanece nulo.
   */
  private async offload(
    tenantId: string,
    podId: string,
    field: 'photo' | 'signature',
    value: string | null | undefined,
  ): Promise<string | null> {
    if (!value) return null;
    if (!isDataUrl(value)) return value;
    const { buffer, contentType, extension } = decodeDataUrl(value);
    const { ref } = await this.storage.save({
      scope: 'pod',
      tenantId,
      id: podId,
      field,
      buffer,
      contentType,
      extension,
    });
    return ref;
  }
}
