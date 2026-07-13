'use client';

import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { useLocale } from '@/lib/i18n/locale-provider';

/** Placeholder padrão das abas de Configurações ainda no roadmap. */
export function ComingSoon({ title, icon: Icon }: { title: string; icon: LucideIcon }) {
  const { t } = useLocale();
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-muted p-3 text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('settings.soon.desc')}</p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground">
          {t('settings.soon')}
        </span>
      </CardContent>
    </Card>
  );
}
