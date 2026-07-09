'use client';

import type { ProofOfDeliveryView } from '@navix/contracts';
import { Clock, MapPin } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { POD_STATUS } from '@/lib/pod/labels';
import { formatDateTime } from '@/lib/utils';

/** Exibe um comprovante de entrega (foto, assinatura, GPS, data/hora, observação). */
export function PodView({ pod }: { pod: ProofOfDeliveryView }) {
  const s = POD_STATUS[pod.status];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={s.tone}>{s.label}</Badge>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {formatDateTime(pod.recordedAt)}
        </span>
        {pod.latitude != null && pod.longitude != null && (
          <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {pod.latitude.toFixed(5)}, {pod.longitude.toFixed(5)}
          </span>
        )}
      </div>

      {(pod.photo || pod.signature) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {pod.photo && (
            <figure>
              <figcaption className="mb-1 text-xs text-muted-foreground">Foto</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pod.photo} alt="Foto do comprovante" className="max-h-56 w-full rounded-lg border border-border object-contain" />
            </figure>
          )}
          {pod.signature && (
            <figure>
              <figcaption className="mb-1 text-xs text-muted-foreground">Assinatura</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pod.signature} alt="Assinatura" className="max-h-56 w-full rounded-lg border border-border bg-white object-contain" />
            </figure>
          )}
        </div>
      )}

      {pod.note && (
        <div>
          <p className="text-xs text-muted-foreground">Observação</p>
          <p className="text-sm">{pod.note}</p>
        </div>
      )}
    </div>
  );
}
