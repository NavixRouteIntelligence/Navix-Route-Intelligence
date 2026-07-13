'use client';

import { useQuery } from '@tanstack/react-query';
import { Gauge, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { trackingApi } from '@/lib/api/tracking';
import { TRACKING_STATUS } from '@/lib/tracking/status';
import { formatDateTime, formatNumber } from '@/lib/utils';

/** Detalhe do motorista com timeline das últimas posições (histórico). */
export function TrackingDetailDialog({
  driverId,
  name,
  open,
  onOpenChange,
}: {
  driverId: string | null;
  name: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['driver-history', driverId],
    queryFn: () => trackingApi.driverHistory(driverId!),
    enabled: open && !!driverId,
  });

  const points = data?.points ?? [];
  const latest = points[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={name} description="Timeline das últimas posições." className="max-w-lg">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {latest && (
            <div className="flex items-center gap-3">
              <Badge tone={TRACKING_STATUS[latest.status].tone}>{TRACKING_STATUS[latest.status].label}</Badge>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                <Gauge className="h-4 w-4" aria-hidden />
                {latest.speed != null ? `${formatNumber(latest.speed, 0)} km/h` : '—'}
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : points.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem histórico de posições recente.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {points.slice(0, 20).map((p, i) => (
                <li key={`${p.recordedAt}-${i}`} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${TRACKING_STATUS[p.status].dot}`}
                    aria-hidden
                  />
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {TRACKING_STATUS[p.status].label}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {p.speed != null ? `${formatNumber(p.speed, 0)} km/h · ` : ''}
                      {formatDateTime(p.recordedAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
