import type { DeliveryPriority } from '@navix/contracts';

/** Dados para criar uma entrega a partir de uma linha importada. */
export interface CreateDeliveryData {
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
  /** Quem recebe (ADR-0076). Sinal-chave para classificar o destino. */
  recipient: string | null;
}

/** Porta anti-corrupção do Import para o contexto Delivery. */
export interface DeliveryCreatorPort {
  /** Cria a entrega e retorna o id. */
  create(data: CreateDeliveryData): Promise<string>;
}

export const DELIVERY_CREATOR = Symbol('DELIVERY_CREATOR');
