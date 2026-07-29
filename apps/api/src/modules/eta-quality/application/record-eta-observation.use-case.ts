import { Inject, Injectable } from '@nestjs/common';

import { newId } from '../../../shared/kernel/id';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import { locationCell } from '../../intelligence/domain/collective-insight';
import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../optimizer/application/optimizer.service';
import { errorMinutes, hourOfWeek, type EtaObservation } from '../domain/eta-observation';
import {
  ETA_OBSERVATION_REPOSITORY,
  type EtaObservationRepositoryPort,
} from '../domain/ports/eta-observation-repository.port';

/**
 * Fecha o par previsão↔real de uma entrega concluída (ADR-0087).
 *
 * É chamado quando a entrega muda de status; só age em `delivered`, porque é a
 * conclusão que define o instante real de chegada. A entrega é relida em vez de
 * confiar no evento: o evento carrega só o id do agregado, e o status é
 * justamente o que decide se há algo a medir.
 *
 * Devolve a medição quando ela é **nova** (e `null` quando não havia nada a
 * medir ou a entrega já fora medida), para que o chamador conte cada amostra
 * uma vez só na métrica.
 */
@Injectable()
export class RecordEtaObservationUseCase {
  constructor(
    @Inject(ETA_OBSERVATION_REPOSITORY)
    private readonly observations: EtaObservationRepositoryPort,
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort,
  ) {}

  async execute(
    tenantId: string,
    deliveryId: string,
    at: Date = new Date(),
  ): Promise<EtaObservation | null> {
    const delivery = await this.deliveries.getPublicSnapshot(tenantId, deliveryId);
    if (!delivery || delivery.status !== 'delivered') return null;

    // A previsão é a do plano **vigente na conclusão** — o ETA que o sistema
    // exibia, que é o que o cliente viu. Viés conhecido e deliberado: uma
    // reotimização corrige a promessa pouco antes da medição, então este número
    // é otimista em relação à promessa original (ver ADR-0087).
    const prediction = await this.optimizer.etaPredictionForDelivery(tenantId, deliveryId);

    const observation: EtaObservation = {
      id: newId(),
      tenantId,
      deliveryId,
      routePlanId: prediction?.routePlanId ?? null,
      predictedArrivalAt: prediction?.arrivalAt ?? null,
      actualArrivalAt: at,
      errorMinutes: errorMinutes(prediction?.arrivalAt ?? null, at),
      source: 'status_change',
      // Mesma célula (~110 m) da inteligência coletiva (ADR-0031): as duas
      // fontes precisam casar para virar feature do mesmo modelo.
      cell: locationCell(delivery.latitude, delivery.longitude),
      hourOfWeek: hourOfWeek(at),
      createdAt: at,
    };

    return (await this.observations.record(observation)) ? observation : null;
  }
}
