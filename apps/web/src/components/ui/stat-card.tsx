import type { LucideIcon } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatChip } from '@/components/ui/stat-chip';
import { cn } from '@/lib/utils';

type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_BG: Record<Tone, string> = {
  primary: 'bg-primary/10 text-primary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  danger: 'bg-danger/10 text-danger',
};

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  delta,
  loading,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: Tone;
  hint?: string;
  /** Chip de variação (paridade com o mobile). */
  delta?: { label: string; positive?: boolean };
  loading?: boolean;
}) {
  return (
    <Card className="p-5 transition-shadow hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-h1 tabular-nums">{value}</p>
          )}
          {!loading && delta && (
            <div className="mt-2">
              <StatChip label={delta.label} positive={delta.positive} />
            </div>
          )}
          {hint && !loading && !delta && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', TONE_BG[tone])}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Card>
  );
}
