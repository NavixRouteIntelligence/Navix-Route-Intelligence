'use client';

import type { ParkingDifficulty, ParkingPredictionView } from '@navix/contracts';
import { CircleParking } from 'lucide-react';

import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useT } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

const TONE: Record<ParkingDifficulty, { labelKey: TranslationKey; cls: string }> = {
  easy: { labelKey: 'parking.easy', cls: 'bg-success/12 text-success' },
  moderate: { labelKey: 'parking.moderate', cls: 'bg-warning/15 text-warning' },
  hard: { labelKey: 'parking.hard', cls: 'bg-danger/12 text-danger' },
};

export interface ParkingBadgeProps {
  prediction: ParkingPredictionView;
  className?: string;
}

/**
 * Previsão de estacionamento (ADR-0029): pill com a dificuldade prevista e a
 * caminhada estimada até a porta. Reutilizável na rota/previsão do motorista.
 */
export function ParkingBadge({ prediction, className }: ParkingBadgeProps) {
  const t = useT();
  const tone = TONE[prediction.difficulty];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
        tone.cls,
        className,
      )}
      title={t('parking.title')}
    >
      <CircleParking className="h-3.5 w-3.5" aria-hidden="true" />
      {t(tone.labelKey)}
      <span className="opacity-70">
        · {prediction.walkMinutes} min {t('parking.walk')}
      </span>
    </span>
  );
}
