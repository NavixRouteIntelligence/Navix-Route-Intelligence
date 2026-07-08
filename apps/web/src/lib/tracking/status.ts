import type { TrackingStatus } from '@navix/contracts';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'primary';

export const TRACKING_STATUS: Record<TrackingStatus, { label: string; tone: Tone; dot: string }> = {
  offline: { label: 'Offline', tone: 'neutral', dot: 'bg-muted-foreground' },
  en_route: { label: 'Em rota', tone: 'success', dot: 'bg-success' },
  finished: { label: 'Finalizado', tone: 'primary', dot: 'bg-primary' },
};
