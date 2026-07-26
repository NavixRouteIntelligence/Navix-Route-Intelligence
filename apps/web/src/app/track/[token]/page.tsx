'use client';

import type { DeliveryStatus } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, PackageX, Truck } from 'lucide-react';
import { use } from 'react';

import { TrackMap } from '@/components/map/track-map';
import { Logo } from '@/components/ui/logo';
import { Spinner } from '@/components/ui/spinner';
import { fetchPublicTracking, TrackingNotFoundError } from '@/lib/api/public-tracking';
import { useLocale, useT } from '@/lib/i18n/locale-provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';

/** Atualiza sozinho durante a entrega — o destinatário deixa a aba aberta. */
const REFRESH_MS = 30_000;

const STATUS_KEY: Record<DeliveryStatus, TranslationKey> = {
  pending: 'track.status.pending',
  in_route: 'track.status.in_route',
  delivered: 'track.status.delivered',
  failed: 'track.status.failed',
  canceled: 'track.status.canceled',
};

const STATUS_TONE: Record<DeliveryStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_route: 'bg-success/15 text-success',
  delivered: 'bg-primary/15 text-primary',
  failed: 'bg-destructive/15 text-destructive',
  canceled: 'bg-muted text-muted-foreground',
};

const STATUS_ICON: Record<DeliveryStatus, typeof Truck> = {
  pending: Clock,
  in_route: Truck,
  delivered: CheckCircle2,
  failed: PackageX,
  canceled: PackageX,
};

export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useT();
  const { locale } = useLocale();

  const { data, isPending, error } = useQuery({
    queryKey: ['public-tracking', token],
    queryFn: () => fetchPublicTracking(token),
    refetchInterval: REFRESH_MS,
    // Link inválido não melhora com retry; falha de rede sim.
    retry: (count, err) => !(err instanceof TrackingNotFoundError) && count < 2,
  });

  const formatTime = (iso: string): string =>
    new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo className="h-7" />
        <h1 className="text-xl font-semibold">{t('track.title')}</h1>
      </header>

      {isPending ? (
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <p>{t('state.loading')}</p>
        </div>
      ) : error ? (
        <ErrorPanel notFound={error instanceof TrackingNotFoundError} t={t} />
      ) : (
        <>
          <StatusCard status={data.status} t={t} />

          {data.status !== 'delivered' && data.status !== 'canceled' ? (
            <section className="rounded-xl border p-4" aria-labelledby="eta-label">
              <p id="eta-label" className="text-sm text-muted-foreground">
                {t('track.eta')}
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {data.estimatedArrival ? formatTime(data.estimatedArrival) : t('track.eta.none')}
              </p>
              {data.estimatedArrival && data.etaIsEstimate ? (
                <p className="mt-1 text-xs text-muted-foreground">{t('track.eta.disclaimer')}</p>
              ) : null}
            </section>
          ) : null}

          {data.status === 'delivered' ? (
            <p className="rounded-xl bg-primary/10 p-4 text-center text-sm text-primary">
              {t('track.delivered.note')}
            </p>
          ) : null}

          <TrackMap
            destination={data.destination}
            vehicle={data.vehiclePosition}
            labels={{ destination: t('track.destination'), vehicle: t('track.vehicle') }}
          />

          {data.vehiclePosition ? (
            <p className="text-center text-xs text-muted-foreground">
              {t('track.vehicle.updated')} {formatTime(data.vehiclePosition.recordedAt)}
            </p>
          ) : null}

          <p className="mt-auto text-center text-xs text-muted-foreground">{t('track.privacy')}</p>
        </>
      )}
    </main>
  );
}

function StatusCard({
  status,
  t,
}: {
  status: DeliveryStatus;
  t: (key: TranslationKey) => string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <section className={`flex items-center gap-3 rounded-xl p-4 ${STATUS_TONE[status]}`}>
      <Icon className="size-6 shrink-0" aria-hidden />
      <div>
        <p className="text-lg font-semibold">{t(STATUS_KEY[status])}</p>
        <p className="text-xs opacity-80">{t('track.subtitle')}</p>
      </div>
    </section>
  );
}

function ErrorPanel({
  notFound,
  t,
}: {
  notFound: boolean;
  t: (key: TranslationKey) => string;
}) {
  return (
    <section className="rounded-xl border p-6 text-center" role="alert">
      <PackageX className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-semibold">
        {t(notFound ? 'track.notFound.title' : 'track.error.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(notFound ? 'track.notFound.description' : 'track.error.description')}
      </p>
    </section>
  );
}
