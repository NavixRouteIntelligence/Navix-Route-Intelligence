'use client';

import type { AccessInstructionKind, AccessInstructionView } from '@navix/contracts';
import { DoorOpen, KeyRound, Bell, PackageOpen, Building2, Info, type LucideIcon } from 'lucide-react';

import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useT } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

const META: Record<AccessInstructionKind, { icon: LucideIcon; labelKey: TranslationKey }> = {
  entrance: { icon: DoorOpen, labelKey: 'access.entrance' },
  dock: { icon: PackageOpen, labelKey: 'access.dock' },
  intercom: { icon: Bell, labelKey: 'access.intercom' },
  gate_code: { icon: KeyRound, labelKey: 'access.gate_code' },
  reception: { icon: Building2, labelKey: 'access.reception' },
  note: { icon: Info, labelKey: 'access.note' },
};

export interface AccessInstructionListProps {
  instructions: AccessInstructionView[];
  className?: string;
}

/**
 * Navegação contextual (ADR-0028): lista de instruções de acesso ao destino,
 * cada uma com ícone e rótulo por tipo. Reutilizável (rota do motorista /
 * previsão). Nada renderiza quando não há instruções.
 */
export function AccessInstructionList({ instructions, className }: AccessInstructionListProps) {
  const t = useT();
  if (instructions.length === 0) return null;

  return (
    <section className={cn('flex flex-col gap-2', className)} aria-label={t('access.title')}>
      <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('access.title')}
      </h4>
      <ul className="flex flex-col gap-1.5">
        {instructions.map((ins, i) => {
          const { icon: Icon, labelKey } = META[ins.kind];
          return (
            <li key={`${ins.kind}-${i}`} className="flex items-start gap-2.5 text-sm">
              <span
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
                aria-hidden="true"
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span>
                <span className="font-medium text-foreground">{t(labelKey)}: </span>
                <span className="text-muted-foreground">{ins.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
