import { Inject, Injectable, Logger } from '@nestjs/common';
import type { DeliveryDistribution, DriverDistributionShare } from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import {
  DELIVERY_LOOKUP,
  type DeliveryLookupPort,
} from '../../delivery/application/delivery-lookup.service';
import {
  DELIVERY_WRITER,
  type DeliveryWriterPort,
} from '../../delivery/application/delivery-writer.service';
import { distributeAmongDrivers } from '../domain/driver-distribution';

import { EnqueueOptimizationUseCase } from './enqueue-optimization.use-case';
import { DRIVER_ROSTER_LINK, type DriverRosterLinkPort } from './ports/driver-roster-link.port';

/** Abaixo disto não há rota a preparar — uma parada só não forma sequência. */
const MIN_STOPS_FOR_PLAN = 2;

export interface DistributeDeliveriesCommand {
  tenantId: string;
  actorId: string;
}

/**
 * Distribui as entregas **sem dono** entre os motoristas ativos e prepara a
 * rota de cada um (ADR-0101).
 *
 * Fecha a lacuna que a ADR-0099 deixou explícita: desde ela, o motorista de uma
 * frota só enxerga as entregas atribuídas a ele — e nada, no produto,
 * atribuía. Atribuir à mão, uma a uma pelo `PATCH`, era o único caminho.
 *
 * **Não desfaz decisão de gente.** Só toca no que está sem motorista; rodar
 * duas vezes seguidas não muda nada, e uma entrega que o despachante ajustou à
 * mão fica onde ele a colocou.
 *
 * **Atribuir e parar por aí não bastaria:** a reotimização automática
 * (ADR-0023) é por tenant e vem desligada por padrão, então o plano de cada
 * motorista não nasceria sozinho — e a tela "Minha Rota" ficaria dizendo "a IA
 * ainda está preparando" para sempre. Por isso a distribuição enfileira, no
 * mesmo caminho assíncrono do `POST /route-plans/mine`, uma otimização por
 * ficha que recebeu trabalho.
 */
@Injectable()
export class DistributeDeliveriesUseCase {
  private readonly logger = new Logger('DistributeDeliveries');

  constructor(
    @Inject(DELIVERY_LOOKUP) private readonly deliveries: DeliveryLookupPort,
    @Inject(DELIVERY_WRITER) private readonly writer: DeliveryWriterPort,
    @Inject(DRIVER_ROSTER_LINK) private readonly roster: DriverRosterLinkPort,
    private readonly enqueue: EnqueueOptimizationUseCase,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: DistributeDeliveriesCommand): Promise<DeliveryDistribution> {
    const { tenantId, actorId } = command;
    const [pendentes, fichas] = await Promise.all([
      this.deliveries.listUnassignedActive(tenantId),
      this.roster.activeDriverIds(tenantId),
    ]);

    // Sem ninguém a quem distribuir, a resposta certa é não mexer em nada — e
    // dizer quantas ficaram esperando, em vez de falhar.
    if (fichas.length === 0 || pendentes.length === 0) {
      return { assigned: 0, unassigned: pendentes.length, shares: [] };
    }

    const { perDriver } = distributeAmongDrivers(
      pendentes.map((d) => ({
        point: { latitude: d.latitude, longitude: d.longitude },
        timeWindow: d.timeWindow
          ? { start: new Date(d.timeWindow.start), end: new Date(d.timeWindow.end) }
          : null,
      })),
      fichas.length,
      // Sem depósito no modelo, a varredura gira em torno do centroide das
      // próprias paradas — é o que o particionador faz quando `origin` é nulo.
      null,
    );

    const shares: DriverDistributionShare[] = [];
    let assigned = 0;

    for (const [index, ficha] of fichas.entries()) {
      const idsDoMotorista: string[] = [];
      for (const stopIndex of perDriver[index] ?? []) {
        const entrega = pendentes[stopIndex];
        // Uma atribuição perdida para o despachante não invalida as outras:
        // conta só o que de fato mudou de dono.
        if (await this.writer.assignDriver({
          tenantId,
          actorId,
          deliveryId: entrega.id,
          driverId: ficha,
        })) {
          idsDoMotorista.push(entrega.id);
        }
      }
      if (idsDoMotorista.length === 0) continue;

      assigned += idsDoMotorista.length;
      shares.push({
        driverId: ficha,
        // O que **esta** distribuição atribuiu — não o tamanho da rota, que
        // inclui o que o motorista já carregava.
        deliveries: idsDoMotorista.length,
        jobId: await this.prepareRoute(tenantId, actorId, ficha),
      });
    }

    await this.audit.record({
      tenantId,
      actorId,
      action: 'delivery.distributed',
      resource: `tenant:${tenantId}`,
      metadata: { assigned, drivers: shares.length, candidates: pendentes.length },
    });

    return { assigned, unassigned: pendentes.length - assigned, shares };
  }

  /**
   * Enfileira a rota do motorista sobre o **dia inteiro** dele, e não apenas
   * sobre o que acabou de receber. A rota do motorista é o trabalho que ele
   * tem pela frente (ADR-0098); planejar só o incremento entregaria ao app uma
   * rota de 3 paradas para quem tem 5 entregas ativas — e as duas antigas
   * sumiriam da sequência sem ter sido concluídas.
   *
   * Nunca deixa a distribuição falhar por causa do plano: as entregas já
   * mudaram de dono e isso é o que não pode se perder — mesma escolha que a
   * ADR-0074 fez na importação, onde a rota que não sai vira `routePlanId:
   * null` em vez de derrubar o lote.
   */
  private async prepareRoute(
    tenantId: string,
    actorId: string,
    driverId: string,
  ): Promise<string | null> {
    const doDia = await this.deliveries.listActiveForDriver(tenantId, driverId);
    const deliveryIds = doDia.map((d) => d.id);
    if (deliveryIds.length < MIN_STOPS_FOR_PLAN) return null;
    try {
      const { jobId } = await this.enqueue.execute({
        tenantId,
        actorId,
        driverId,
        deliveryIds,
        smart: true,
      });
      return jobId;
    } catch (error) {
      this.logger.warn(
        `Distribuição gravada, mas a rota do motorista ${driverId} não foi enfileirada: ${String(error)}`,
      );
      return null;
    }
  }
}
