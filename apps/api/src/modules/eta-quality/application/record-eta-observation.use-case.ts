import { Inject, Injectable } from '@nestjs/common';

import { newId } from '../../../shared/kernel/id';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import { locationCell } from '../../intelligence/domain/collective-insight';
import { RecordDerivedServiceTimeUseCase } from '../../intelligence/application/record-derived-service-time.use-case';
import {
  OPTIMIZER_SERVICE,
  type OptimizerServicePort,
} from '../../optimizer/application/optimizer.service';
import { QueryPositionsUseCase } from '../../tracking/application/query-positions.use-case';
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
 * Mede **duas** coisas no mesmo instante, porque ambas precisam do mesmo
 * evento, da mesma entrega e da mesma transação de tenant: o erro do ETA e o
 * tempo de atendimento real, derivado do rastro de GPS (ADR-0088). Um segundo
 * listener para o mesmo evento só duplicaria o trabalho.
 *
 * Devolve a medição de ETA quando ela é **nova** (e `null` quando não havia
 * nada a medir ou a entrega já fora medida), para que o chamador conte cada
 * amostra uma vez só na métrica.
 */
@Injectable()
export class RecordEtaObservationUseCase {
  constructor(
    @Inject(ETA_OBSERVATION_REPOSITORY)
    private readonly observations: EtaObservationRepositoryPort,
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(OPTIMIZER_SERVICE) private readonly optimizer: OptimizerServicePort,
    private readonly positions: QueryPositionsUseCase,
    private readonly serviceTime: RecordDerivedServiceTimeUseCase,
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
      correctionMinutes: prediction?.correctionMinutes ?? 0,
      source: 'status_change',
      // Mesma célula (~110 m) da inteligência coletiva (ADR-0031): as duas
      // fontes precisam casar para virar feature do mesmo modelo.
      cell: locationCell(delivery.latitude, delivery.longitude),
      hourOfWeek: hourOfWeek(at),
      createdAt: at,
    };

    const registrada = await this.observations.record(observation);
    // Só na primeira vez: a mesma entrega reprocessada não pode gerar uma
    // segunda amostra de tempo de atendimento na mediana da célula.
    if (registrada) await this.recordServiceTime(tenantId, delivery, at);
    return registrada ? observation : null;
  }

  /**
   * Tempo de atendimento medido no rastro (ADR-0088). Silencioso por desenho:
   * na maior parte das entregas não haverá rastro suficiente (motorista sem
   * app, GPS desligado), e ausência de medição é o caso normal, não uma falha.
   */
  private async recordServiceTime(
    tenantId: string,
    delivery: { driverId: string | null; latitude: number; longitude: number },
    at: Date,
  ): Promise<void> {
    if (!delivery.driverId) return;

    const minutes = await this.positions.serviceMinutesAtStop(
      tenantId,
      delivery.driverId,
      { latitude: delivery.latitude, longitude: delivery.longitude },
      at,
    );
    if (minutes === null) return;

    await this.serviceTime.execute({
      tenantId,
      driverId: delivery.driverId,
      latitude: delivery.latitude,
      longitude: delivery.longitude,
      minutes,
    });
  }
}
