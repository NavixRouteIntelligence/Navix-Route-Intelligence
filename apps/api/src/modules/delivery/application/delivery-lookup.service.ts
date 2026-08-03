import { Inject, Injectable } from '@nestjs/common';
import type { DeliveryPriority, DeliveryStatus, TimeWindow } from '@navix/contracts';

import type { Delivery } from '../domain/delivery';
import {
  DELIVERY_REPOSITORY,
  type DeliveryRepositoryPort,
} from '../domain/ports/delivery-repository.port';

/** Parada exportada para consumo externo (ex.: Optimizer). */
export interface DeliveryStopDto {
  id: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  timeWindow: TimeWindow | null;
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
}

export const DELIVERY_LOOKUP = Symbol('DELIVERY_LOOKUP');

@Injectable()
export class DeliveryLookupService implements DeliveryLookupPort {
  constructor(
    @Inject(DELIVERY_REPOSITORY) private readonly deliveries: DeliveryRepositoryPort,
  ) {}

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

  async listNotifiableActive(tenantId: string, driverId?: string): Promise<NotifiableDeliveryDto[]> {
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
      timeWindow: {
        start: s.timeWindow.start.toISOString(),
        end: s.timeWindow.end.toISOString(),
      },
      ...(addressText ? { addressText } : {}),
      ...(s.recipient ? { recipient: s.recipient } : {}),
    };
  }
}
