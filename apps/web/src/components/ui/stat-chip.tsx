import { ArrowDown, ArrowUp } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Chip de variação (▲/▼ %) — paridade com o Design System do mobile
 * (NavixStatChip). A cor acompanha o sinal (positivo/negativo).
 */
export function StatChip({ label, positive = true }: { label: string; positive?: boolean }) {
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
        positive ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}
