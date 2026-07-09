import type { PodStatus } from '@navix/contracts';

type Tone = 'success' | 'warning' | 'danger';

export const POD_STATUS: Record<PodStatus, { label: string; tone: Tone }> = {
  delivered: { label: 'Entregue', tone: 'success' },
  absent: { label: 'Ausente', tone: 'warning' },
  refused: { label: 'Recusado', tone: 'danger' },
};
