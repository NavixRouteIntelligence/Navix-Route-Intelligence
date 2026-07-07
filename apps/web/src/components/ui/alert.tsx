import { AlertCircle, CheckCircle2, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'error';

const CONFIG: Record<Tone, { icon: LucideIcon; className: string }> = {
  info: { icon: Info, className: 'border-primary/30 bg-primary/5 text-foreground' },
  success: { icon: CheckCircle2, className: 'border-success/30 bg-success/10 text-foreground' },
  warning: { icon: TriangleAlert, className: 'border-warning/40 bg-warning/10 text-foreground' },
  error: { icon: AlertCircle, className: 'border-danger/30 bg-danger/10 text-foreground' },
};

const ICON_TONE: Record<Tone, string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = CONFIG[tone];
  return (
    <div role="alert" className={cn('flex gap-3 rounded-lg border p-3.5 text-sm', toneClass, className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_TONE[tone])} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="text-muted-foreground [&_p]:mt-0.5">{children}</div>}
      </div>
    </div>
  );
}
