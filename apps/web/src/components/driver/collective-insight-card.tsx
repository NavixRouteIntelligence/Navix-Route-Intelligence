'use client';

import type { CollectiveInsightView, ParkingDifficulty } from '@navix/contracts';
import { Clock, DoorOpen, SquareParking, Users } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useT } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

const PARKING_LABEL: Record<ParkingDifficulty, TranslationKey> = {
  easy: 'parking.easy',
  moderate: 'parking.moderate',
  hard: 'parking.hard',
};

const PARKING_TONE: Record<ParkingDifficulty, 'success' | 'warning' | 'danger'> = {
  easy: 'success',
  moderate: 'warning',
  hard: 'danger',
};

export interface CollectiveInsightCardProps {
  insight: CollectiveInsightView;
  className?: string;
}

/**
 * Inteligência coletiva (ADR-0031): mostra o que a frota do tenant aprendeu num
 * local — estacionamento típico, tempo de atendimento e dicas de acesso — com o
 * tamanho da amostra. Reutilizável na preparação/execução da rota do motorista.
 */
export function CollectiveInsightCard({ insight, className }: CollectiveInsightCardProps) {
  const t = useT();
  const hasSignal =
    insight.parking !== undefined ||
    insight.typicalServiceMinutes !== undefined ||
    insight.accessTips.length > 0;

  return (
    <section
      className={cn('flex flex-col gap-3 rounded-lg border border-border/60 p-3', className)}
      aria-label={t('insight.title')}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            {t('insight.title')}
          </h4>
          <p className="text-xs text-muted-foreground">{t('insight.subtitle')}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {insight.sampleSize} {t('insight.samples')}
        </span>
      </header>

      {!hasSignal ? (
        <p className="text-sm text-muted-foreground">{t('insight.empty')}</p>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          {insight.parking && (
            <div className="flex items-center gap-2">
              <SquareParking className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <dt className="text-muted-foreground">{t('insight.parking')}:</dt>
              <dd>
                <Badge tone={PARKING_TONE[insight.parking.difficulty]}>
                  {t(PARKING_LABEL[insight.parking.difficulty])}
                </Badge>
              </dd>
            </div>
          )}

          {insight.typicalServiceMinutes !== undefined && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <dt className="text-muted-foreground">{t('insight.service')}:</dt>
              <dd className="font-medium text-foreground">
                {insight.typicalServiceMinutes} {t('insight.minutes')}
              </dd>
            </div>
          )}

          {insight.accessTips.length > 0 && (
            <div className="flex items-start gap-2">
              <DoorOpen className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <dt className="text-muted-foreground">{t('insight.tips')}:</dt>
                <dd>
                  <ul className="mt-1 flex flex-col gap-1">
                    {insight.accessTips.map((tip) => (
                      <li key={tip} className="text-foreground">
                        · {tip}
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </div>
          )}
        </dl>
      )}
    </section>
  );
}
