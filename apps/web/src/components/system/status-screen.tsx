import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Logo } from '@/components/ui/logo';

/** Tela de sistema (404/403/500/offline). Centralizada, com marca e ações. */
export function StatusScreen({
  icon: Icon,
  code,
  title,
  description,
  actions,
  tone = 'primary',
}: {
  icon: LucideIcon;
  code?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  tone?: 'primary' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'bg-danger/10 text-danger'
      : tone === 'warning'
        ? 'bg-warning/10 text-warning'
        : 'bg-primary/10 text-primary';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 text-center">
      <Logo />
      <div className="flex flex-col items-center gap-4 animate-fade-in">
        <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-8 w-8" aria-hidden />
        </span>
        {code && <p className="text-sm font-mono font-medium text-muted-foreground">{code}</p>}
        <h1 className="text-h1">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {actions && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </main>
  );
}
