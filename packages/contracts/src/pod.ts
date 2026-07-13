/**
 * Contratos do Proof of Delivery (POD) — comprovante de entrega.
 * No envio, foto e assinatura trafegam como data URLs; o backend faz o offload
 * para object storage (ADR-0019) e a view expõe a URL hospedada da mídia.
 */

/** Desfecho da entrega registrado pelo motorista. */
export type PodStatus = 'delivered' | 'absent' | 'refused';

export const POD_STATUSES: readonly PodStatus[] = ['delivered', 'absent', 'refused'];

/** Criação de um comprovante para uma entrega. */
export interface CreatePodRequest {
  deliveryId: string;
  status: PodStatus;
  note?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Foto (image/*): data URL a enviar, ou URL já hospedada. Opcional. */
  photo?: string | null;
  /** Assinatura (image/png): data URL a enviar, ou URL já hospedada. Opcional. */
  signature?: string | null;
}

/** Representação pública do comprovante. */
export interface ProofOfDeliveryView {
  id: string;
  deliveryId: string;
  driverId: string;
  status: PodStatus;
  note: string | null;
  latitude: number | null;
  longitude: number | null;
  photo: string | null;
  signature: string | null;
  recordedAt: string;
}

/** Resumo por status (Dashboard). */
export interface PodSummary {
  delivered: number;
  absent: number;
  refused: number;
  total: number;
}
