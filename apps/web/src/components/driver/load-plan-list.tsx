'use client';

import type { LoadPlanView, LoadZone } from '@navix/contracts';
import { AlertTriangle, PackageCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useT } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

const ZONE: Record<LoadZone, { labelKey: TranslationKey; tone: 'success' | 'warning' | 'neutral' }> = {
  door: { labelKey: 'load.zone.door', tone: 'success' },
  middle: { labelKey: 'load.zone.middle', tone: 'neutral' },
  front: { labelKey: 'load.zone.front', tone: 'warning' },
};

const WARNING_KEY: Record<string, TranslationKey> = {
  weight_over_capacity: 'load.warning.weight_over_capacity',
  volume_over_capacity: 'load.warning.volume_over_capacity',
  fragile_under_load: 'load.warning.fragile_under_load',
};

function pct(value: number | null): string | null {
  return value === null ? null : `${Math.round(value * 100)}%`;
}

export interface LoadPlanListProps {
  plan: LoadPlanView;
  className?: string;
}

/**
 * Organização otimizada da carga (ADR-0030): lista os itens na ordem de
 * carregamento (LIFO), com zona de estiva, peso/volume e frágil, além de
 * ocupação e avisos. Reutilizável na preparação da rota do motorista.
 */
export function LoadPlanList({ plan, className }: LoadPlanListProps) {
  const t = useT();
  const weightUtil = pct(plan.weightUtilization);
  const volumeUtil = pct(plan.volumeUtilization);

  return (
    <section className={cn('flex flex-col gap-3', className)} aria-label={t('load.title')}>
      <header className="flex flex-col gap-0.5">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <PackageCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          {t('load.title')}
        </h4>
        <p className="text-xs text-muted-foreground">{t('load.subtitle')}</p>
      </header>

      {(weightUtil || volumeUtil) && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('load.utilization')}:{' '}
          {weightUtil && (
            <span className={cn('font-medium', plan.overCapacity && 'text-danger')}>
              {t('load.weight')} {weightUtil}
            </span>
          )}
          {weightUtil && volumeUtil && ' · '}
          {volumeUtil && (
            <span className={cn('font-medium', plan.overCapacity && 'text-danger')}>
              {t('load.volume')} {volumeUtil}
            </span>
          )}
        </p>
      )}

      <ol className="flex flex-col gap-1.5">
        {plan.placements.map((p) => {
          const zone = ZONE[p.zone];
          return (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
            >
              <span
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary"
                aria-label={`${t('load.order')} ${p.loadOrder}`}
              >
                {p.loadOrder}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                {p.label ?? p.id}
              </span>
              {p.fragile && <Badge tone="danger">{t('load.fragile')}</Badge>}
              <Badge tone={zone.tone}>{t(zone.labelKey)}</Badge>
            </li>
          );
        })}
      </ol>

      {plan.warnings.length > 0 && (
        <ul className="flex flex-col gap-1" role="alert">
          {plan.warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t(WARNING_KEY[w] ?? 'load.title')}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
