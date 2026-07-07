import type { ImportSummary } from '@navix/contracts';
import { AlertTriangle, CopyCheck, PackageCheck, TrendingDown } from 'lucide-react';

import { StatCard } from '@/components/ui/stat-card';

/** Cartões de resumo da pré-visualização: total, inválidos, duplicados, economia. */
export function ImportSummaryCards({ summary }: { summary: ImportSummary }) {
  const savings =
    summary.estimatedSavingsKm > 0
      ? `${summary.estimatedSavingsKm.toFixed(1)} km (${summary.estimatedSavingsPct.toFixed(0)}%)`
      : '—';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Entregas válidas"
        value={summary.valid}
        icon={PackageCheck}
        tone="success"
        hint={`${summary.total} registros no total`}
      />
      <StatCard
        label="Registros inválidos"
        value={summary.invalid}
        icon={AlertTriangle}
        tone={summary.invalid > 0 ? 'danger' : 'primary'}
      />
      <StatCard
        label="Duplicados"
        value={summary.duplicates}
        icon={CopyCheck}
        tone={summary.duplicates > 0 ? 'warning' : 'primary'}
      />
      <StatCard
        label="Economia estimada"
        value={savings}
        icon={TrendingDown}
        tone="accent"
        hint="Ao otimizar a rota"
      />
    </div>
  );
}
