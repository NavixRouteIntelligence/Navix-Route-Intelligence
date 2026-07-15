'use client';

import type { EconomyMode } from '@navix/contracts';
import { Clock, Coins, Fuel, Leaf, Scale, type LucideIcon } from 'lucide-react';

import { useT } from '@/lib/i18n/locale-provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { cn } from '@/lib/utils';

type Option = {
  value: EconomyMode | 'balanced';
  icon: LucideIcon;
  labelKey: TranslationKey;
  descKey?: TranslationKey;
};

const OPTIONS: Option[] = [
  { value: 'balanced', icon: Scale, labelKey: 'economy.balanced' },
  { value: 'time', icon: Clock, labelKey: 'economy.time', descKey: 'economy.time.desc' },
  { value: 'fuel', icon: Fuel, labelKey: 'economy.fuel', descKey: 'economy.fuel.desc' },
  { value: 'tolls', icon: Coins, labelKey: 'economy.tolls', descKey: 'economy.tolls.desc' },
  { value: 'co2', icon: Leaf, labelKey: 'economy.co2', descKey: 'economy.co2.desc' },
];

export interface EconomyModeSelectorProps {
  value?: EconomyMode;
  onChange: (mode?: EconomyMode) => void;
  className?: string;
}

/**
 * Seletor do Modo Economia (ADR-0026): controle segmentado acessível
 * (radiogroup) para escolher o objetivo da otimização. Reusa os tokens do DS.
 */
export function EconomyModeSelector({ value, onChange, className }: EconomyModeSelectorProps) {
  const t = useT();
  const current = value ?? 'balanced';

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('economy.label')}
      </span>
      <div
        role="radiogroup"
        aria-label={t('economy.label')}
        className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/40 p-1"
      >
        {OPTIONS.map(({ value: v, icon: Icon, labelKey, descKey }) => {
          const active = current === v;
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={active}
              title={descKey ? t(descKey) : undefined}
              onClick={() => onChange(v === 'balanced' ? undefined : v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-card text-foreground shadow-card ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t(labelKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
