import type {
  DeliveryPriority,
  DeliveryStatus,
  DriverStatus,
  VehicleStatus,
} from '@navix/contracts';

import { Badge } from '@/components/ui/badge';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pendente', tone: 'neutral' },
  in_route: { label: 'Em rota', tone: 'primary' },
  delivered: { label: 'Entregue', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
  canceled: { label: 'Cancelada', tone: 'warning' },
};

const PRIORITY: Record<DeliveryPriority, { label: string; tone: Tone }> = {
  low: { label: 'Baixa', tone: 'neutral' },
  normal: { label: 'Normal', tone: 'primary' },
  high: { label: 'Alta', tone: 'warning' },
  urgent: { label: 'Urgente', tone: 'danger' },
};

const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  active: { label: 'Ativo', tone: 'success' },
  inactive: { label: 'Inativo', tone: 'neutral' },
  maintenance: { label: 'Manutenção', tone: 'warning' },
};

const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: Tone }> = {
  active: { label: 'Ativo', tone: 'success' },
  inactive: { label: 'Inativo', tone: 'neutral' },
};

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  const c = DELIVERY_STATUS[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: DeliveryPriority }) {
  const c = PRIORITY[priority];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const c = VEHICLE_STATUS[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const c = DRIVER_STATUS[status];
  return <Badge tone={c.tone}>{c.label}</Badge>;
}
