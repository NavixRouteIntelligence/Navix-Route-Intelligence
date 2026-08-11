import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority, DeliveryStatus, TimeWindow } from '@navix/contracts';

import type { Delivery } from '../domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type ActiveLoadByDriver,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';

/** Parada exportada para consumo externo (ex.: Optimizer). */
export interface DeliveryStopDto {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
  /** Estado atual. É o que distingue parada feita de parada por fazer. */
  status: DeliveryStatus;
  /**
   * Texto do endereço (rua, complemento, cidade) — **dado**, não classificação.
   * Deixa o Optimizer classificar o tipo de destino sem inverter a dependência
   * entre módulos (ADR-0064). Ausente quando não há endereço textual.
   */
  addressText?: string;
  /**
   * Nome de quem recebe — **dado**, não classificação, pela mesma razão de
   * [addressText]. "Acme Ltda" identifica uma empresa que o endereço sozinho
   * não revela (ADR-0076). Ausente quando a origem não informou.
   */
  recipient?: string;
  /**
   * Demanda da entrega (ADR-0109). `null` quando não informada — e é o caso da
   * maioria hoje, porque a importação ainda não a traz. Quem consome decide o
   * que fazer com a ausência; este módulo só reporta o que sabe.
   */
  weightKg: number | null;
  volumeM3: number | null;
  /** Veículo atribuído à entrega. É dele que sai a capacidade da rota (ADR-0109). */
  vehicleId: string | null;
}

/**
 * Recorte mínimo da entrega para o rastreamento público (ADR-0082): só o que
 * a página do destinatário precisa. Deliberadamente **sem** endereço textual,
 * destinatário ou observações — quem consome isto serve um endpoint anônimo.
 */
export interface DeliveryPublicSnapshot {
  status: DeliveryStatus;
  /** Necessário para localizar o veículo; nunca sai na resposta pública. */
  driverId: string | null;
  latitude: number;
  longitude: number;
}

/**
 * Recorte para as notificações ao destinatário (ADR-0084). Inclui o contato —
 * PII de terceiros —, então só o módulo de notificações consome, e nunca chega
 * à página pública de rastreio.
 */
export interface NotifiableDeliveryDto {
  id: string;
  status: DeliveryStatus;
  recipient: string | null;
  recipientEmail: string | null;
  recipientPhone: string | null;
  latitude: number;
  longitude: number;
  driverId: string | null;
}

/** A quem uma entrega pertence. `driverId` nulo = sem motorista atribuído. */
export interface DeliveryOwnershipDto {
  id: string;
  driverId: string | null;
}

/**
 * API pública do contexto Delivery. Expõe apenas o necessário para outros
 * módulos (ex.: Optimizer) sem revelar o agregado/repositório internos.
 */
export interface DeliveryLookupPort {
  /** Uma entrega com contato, para notificar (ADR-0084). */
  getNotifiable(tenantId: string, id: string): Promise<NotifiableDeliveryDto | null>;
  /**
   * Entregas ativas (pendente/em rota) com contato. Filtra por motorista quando
   * informado — base do aviso "está chegando".
   */
  listNotifiableActive(tenantId: string, driverId?: string): Promise<NotifiableDeliveryDto[]>;
  /** Snapshot mínimo para o rastreamento público (ADR-0082). */
  getPublicSnapshot(tenantId: string, id: string): Promise<DeliveryPublicSnapshot | null>;
  getStops(tenantId: string, ids: string[]): Promise<DeliveryStopDto[]>;
  /**
   * A quem pertence cada entrega pedida (ADR-0099). Devolve **só as visíveis**
   * no tenant: quem chama compara com o que pediu e decide o que fazer com a
   * diferença — este módulo não sabe o que ela significa para o chamador.
   */
  getOwnership(tenantId: string, ids: string[]): Promise<DeliveryOwnershipDto[]>;
  /**
   * Nº de entregas **concluídas** (`delivered`) com conclusão no intervalo
   * [from, to] — base do lucro/entrega (Finance, FASE 3). Aproxima a conclusão
   * por `updatedAt` (status terminal).
   */
  countDeliveredInRange(tenantId: string, from: Date, to: Date): Promise<number>;
  /** Entregas **ativas** (pendente/em rota) — base da reotimização (ADR-0023). */
  listActive(tenantId: string): Promise<DeliveryStopDto[]>;
  /**
   * Entregas ativas **sem motorista atribuído** — o que a distribuição tem para
   * repartir (ADR-0101). Distinta de `listActive` de propósito: distribuir é
   * sobre quem ainda não tem dono, e reaproveitar `listActive` obrigaria quem
   * chama a filtrar por um campo que o `DeliveryStopDto` nem expõe.
   */
  listUnassignedActive(tenantId: string): Promise<DeliveryStopDto[]>;
  /**
   * Entregas ativas **de uma ficha** — o dia inteiro daquele motorista, que é o
   * que a rota dele precisa cobrir (ADR-0098/0101). Distinta de
   * `listNotifiableActive`, que carrega o contato do destinatário: quem monta
   * rota não precisa de PII.
   */
  listActiveForDriver(tenantId: string, driverId: string): Promise<DeliveryStopDto[]>;
  /**
   * Carga ativa por motorista, agregada no banco (ADR-0101). O balde de
   * `driverId: null` é o que ainda não tem dono.
   */
  countActiveByDriver(tenantId: string): Promise<ActiveLoadByDriver[]>;
}

export const DELIVERY_LOOKUP = Symbol('DELIVERY_LOOKUP');

@Injectable()
export class DeliveryLookupService implements DeliveryLookupPort {
  constructor(@Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort) {}

  async getStops(tenantId: string, ids: string[]): Promise<DeliveryStopDto[]> {
    const found = await this.deliveries.findByIds(tenantId, ids);
    return found.map((d) => this.toDto(d));
  }

  async getOwnership(tenantId: string, ids: string[]): Promise<DeliveryOwnershipDto[]> {
    const found = await this.deliveries.findByIds(tenantId, ids);
    return found.map((d) => ({ id: d.snapshot().id, driverId: d.snapshot().driverId }));
  }

  async listActive(tenantId: string): Promise<DeliveryStopDto[]> {
    // Reusa findAll (soft-deletadas já excluídas) e filtra os status ativos —
    // as que ainda fazem parte de um roteiro (pendente/em rota).
    const { items } = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 500 },
      filters: {},
      sort: [],
    });
    return items
      .filter((d) => {
        const status = d.snapshot().status;
        return status === 'pending' || status === 'in_route';
      })
      .map((d) => this.toDto(d));
  }

  async listUnassignedActive(tenantId: string): Promise<DeliveryStopDto[]> {
    // `driverId: null` é o filtro "sem motorista atribuído" da ADR-0100 — o
    // mesmo que serve o motorista autônomo. Aqui ele delimita exatamente o
    // lote a repartir, sem varrer o tenant inteiro na aplicação.
    const { items } = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 500 },
      filters: { driverId: null },
      sort: [],
    });
    return items
      .filter((d) => {
        const status = d.snapshot().status;
        return status === 'pending' || status === 'in_route';
      })
      .map((d) => this.toDto(d));
  }

  async listActiveForDriver(tenantId: string, driverId: string): Promise<DeliveryStopDto[]> {
    const { items } = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 500 },
      filters: { driverId },
      sort: [],
    });
    return items
      .filter((d) => {
        const status = d.snapshot().status;
        return status === 'pending' || status === 'in_route';
      })
      .map((d) => this.toDto(d));
  }

  countActiveByDriver(tenantId: string): Promise<ActiveLoadByDriver[]> {
    return this.deliveries.countActiveByDriver(tenantId);
  }

  async countDeliveredInRange(tenantId: string, from: Date, to: Date): Promise<number> {
    const { items } = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 1000 },
      filters: {},
      sort: [],
    });
    return items.filter((d) => {
      const s = d.snapshot();
      if (s.status !== 'delivered') return false;
      const t = s.updatedAt.getTime();
      return t >= from.getTime() && t <= to.getTime();
    }).length;
  }

  async getPublicSnapshot(tenantId: string, id: string): Promise<DeliveryPublicSnapshot | null> {
    // Passa pela RLS como qualquer leitura: entrega de outro tenant não existe.
    const delivery = await this.deliveries.findById(tenantId, id);
    if (!delivery) return null;

    const s = delivery.snapshot();
    return {
      status: s.status,
      driverId: s.driverId,
      latitude: s.address.latitude,
      longitude: s.address.longitude,
    };
  }

  async getNotifiable(tenantId: string, id: string): Promise<NotifiableDeliveryDto | null> {
    const delivery = await this.deliveries.findById(tenantId, id);
    return delivery ? this.toNotifiable(delivery) : null;
  }

  async listNotifiableActive(
    tenantId: string,
    driverId?: string,
  ): Promise<NotifiableDeliveryDto[]> {
    const active = await this.deliveries.findAll(tenantId, {
      page: { page: 1, pageSize: 100 },
      filters: { driverId },
      sort: [],
    });
    return active.items
      .filter((d) => {
        const s = d.snapshot();
        return s.status === 'pending' || s.status === 'in_route';
      })
      .map((d) => this.toNotifiable(d));
  }

  private toNotifiable(d: Delivery): NotifiableDeliveryDto {
    const s = d.snapshot();
    const address = s.address.snapshot();
    return {
      id: s.id,
      status: s.status,
      recipient: s.recipient,
      recipientEmail: s.recipientEmail,
      recipientPhone: s.recipientPhone,
      latitude: address.latitude,
      longitude: address.longitude,
      driverId: s.driverId,
    };
  }

  private toDto(d: Delivery): DeliveryStopDto {
    const s = d.snapshot();
    const address = s.address.snapshot();
    const addressText = [address.street, address.complement, address.city]
      .filter((p): p is string => !!p && p.length > 0)
      .join(' ');
    return {
      id: s.id,
      latitude: address.latitude,
      longitude: address.longitude,
      priority: s.priority,
      status: s.status,
      timeWindow: {
        start: s.timeWindow.start.toISOString(),
        end: s.timeWindow.end.toISOString(),
      },
      weightKg: s.weightKg,
      volumeM3: s.volumeM3,
      vehicleId: s.vehicleId,
      ...(addressText ? { addressText } : {}),
      ...(s.recipient ? { recipient: s.recipient } : {}),
    };
  }
}
