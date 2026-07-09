/**
 * Contratos do Proof of Delivery (POD) — comprovante de entrega.
 * Foto e assinatura trafegam como data URLs (produção usaria object storage).
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
  /** Data URL da foto (image/*), opcional. */
  photo?: string | null;
  /** Data URL da assinatura (image/png), opcional. */
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
