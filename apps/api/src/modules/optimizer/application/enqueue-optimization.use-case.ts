import { Inject, Injectable } from '@nestjs/common';
import type { OptimizationJobAccepted } from '@navix/contracts';

import { ForbiddenError, NotFoundError } from '../../../shared/kernel/domain-error';
import {
  TENANT_TIME_ZONE_READER,
  type TenantTimeZoneReaderPort,
} from '../../../shared/tenancy/tenant-time-zone.port';
import { newId } from '../../../shared/kernel/id';
import { checkOwnership, isFullyOwned } from '../domain/delivery-ownership';
import {
  OPTIMIZATION_JOB_QUEUE,
  type OptimizationJobQueuePort,
} from '../domain/ports/optimization-job-queue.port';
import {
  OPTIMIZATION_JOB_REPOSITORY,
  type OptimizationJobRepositoryPort,
  type OptimizationJobRequest,
} from '../domain/ports/optimization-job-repository.port';

import { DELIVERY_GATEWAY, type DeliveryGatewayPort } from './ports/delivery-gateway.port';

export interface EnqueueOptimizationCommand extends OptimizationJobRequest {
  tenantId: string;
  /**
   * Presente quando quem pede é um **motorista** (ADR-0099): então toda entrega
   * enviada tem de ser dele. Ausente na otimização do despacho, que legitima­-
   * mente roteiriza a frota inteira.
   *
   * É um objeto, e não um `driverId` solto, porque o motorista autônomo tem
   * ficha `null` — presença e valor precisam ser coisas distintas, ou o
   * autônomo escaparia da verificação exatamente como quem não é motorista.
   */
  ownership?: { driverId: string | null };
}

/**
 * Enfileira uma otimização: persiste um job `queued` (na transação de tenant do
 * request) e agenda o processamento assíncrono. Responde imediatamente com o
 * `jobId` — o solver roda fora da requisição (ADR-0007).
 */
@Injectable()
export class EnqueueOptimizationUseCase {
  constructor(
    @Inject(OPTIMIZATION_JOB_REPOSITORY) private readonly jobs: OptimizationJobRepositoryPort,
    @Inject(OPTIMIZATION_JOB_QUEUE) private readonly queue: OptimizationJobQueuePort,
    @Inject(DELIVERY_GATEWAY) private readonly deliveries: DeliveryGatewayPort,
    @Inject(TENANT_TIME_ZONE_READER) private readonly zones: TenantTimeZoneReaderPort,
  ) {}

  async execute(command: EnqueueOptimizationCommand): Promise<OptimizationJobAccepted> {
    const { tenantId, ownership, ...request } = command;
    // Antes de enfileirar: quem pede tem de ser dono do que pediu. A verificação
    // é **síncrona** de propósito — se fosse no worker, o cliente receberia 202
    // e um job que falha depois, em vez de uma recusa que ele entende.
    if (ownership) await this.assertOwnership(tenantId, request.deliveryIds, ownership.driverId);

    // Resolvido aqui, no pedido, e não no worker: o fuso do tenant pode mudar
    // entre enfileirar e processar, e o dia operacional tem de ser o de quando
    // a pessoa pediu (ADR-0105).
    const timeZone = await this.zones.findTimeZone(tenantId);

    const jobId = newId();
    await this.jobs.create({
      id: jobId,
      tenantId,
      status: 'queued',
      request: { ...request, timeZone },
      routePlanId: null,
      error: null,
    });
    // Aguardado de propósito: se o agendamento falhar, a exceção sobe e a
    // transação do request desfaz o job recém-criado. Sem isso o cliente
    // receberia 202 com um jobId que nunca sairia de `queued` (ADR-0081).
    await this.queue.enqueue(jobId, tenantId);
    return { jobId, status: 'queued' };
  }

  /**
   * `stops` (coordenadas cruas) não passa por aqui, e não é omissão: não há
   * entrega envolvida, então não há dono a verificar — são pontos que o próprio
   * motorista digitou.
   */
  private async assertOwnership(
    tenantId: string,
    deliveryIds: string[] | undefined,
    driverId: string | null,
  ): Promise<void> {
    if (!deliveryIds?.length) return;

    const visiveis = await this.deliveries.getOwnership(tenantId, deliveryIds);
    const verdict = checkOwnership(deliveryIds, visiveis, driverId);
    if (isFullyOwned(verdict)) return;

    // Id que o tenant não enxerga vem primeiro: pode ser de outro tenant (a RLS
    // o esconde) ou não existir, e nos dois casos "não encontrado" é a verdade.
    if (verdict.missing.length > 0) {
      throw new NotFoundError(`Entrega não encontrada: ${verdict.missing.join(', ')}.`);
    }
    throw new ForbiddenError(`Estas entregas não são suas: ${verdict.foreign.join(', ')}.`);
  }
}
