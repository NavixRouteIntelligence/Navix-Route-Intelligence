'use client';

import type { ImportRowStatus, ImportRowView } from '@navix/contracts';
import { AlertCircle, MapPin } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { PriorityBadge } from '@/components/ui/status-badge';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { ADDRESS_CATEGORY_LABEL, ROW_STATUS } from '@/lib/import-labels';

type Filter = 'all' | ImportRowStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'valid', label: 'Válidas' },
  { key: 'invalid', label: 'Inválidas' },
  { key: 'duplicate', label: 'Duplicadas' },
];

/** Tabela de pré-visualização das linhas, com filtro por status e erros inline. */
export function ImportPreviewTable({ rows }: { rows: ImportRowView[] }) {
  const [filter, setFilter] = useState<Filter>('all');

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: rows.length, valid: 0, invalid: 0, duplicate: 0 };
    for (const r of rows) c[r.status] += 1;
    return c;
  }, [rows]);

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label} ({counts[f.key]})
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <Table>
          <THead>
            <TR>
              <TH>#</TH>
              <TH>Destinatário</TH>
              <TH>Endereço</TH>
              <TH>Telefone</TH>
              <TH>Encomenda</TH>
              <TH>Tipo</TH>
              <TH>Prioridade</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {visible.map((r) => (
              <TR key={r.index}>
                <TD className="text-muted-foreground tabular-nums">{r.index}</TD>
                <TD>
                  <span className="font-medium">{r.recipient ?? '—'}</span>
                  {r.lowConfidence && (
                    <Badge tone="warning" className="ml-2">
                      baixa confiança
                    </Badge>
                  )}
                </TD>
                <TD className="max-w-xs">
                  <span className="flex items-center gap-1">
                    {r.geocoded && <MapPin className="h-3.5 w-3.5 shrink-0 text-success" aria-label="Geocodificado" />}
                    <span className="truncate">{r.addressText || '—'}</span>
                  </span>
                  {r.errors.length > 0 && (
                    <span className="mt-1 flex items-start gap-1 text-xs text-danger">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{r.errors.join('; ')}</span>
                    </span>
                  )}
                </TD>
                <TD className="text-muted-foreground">{r.phone ?? '—'}</TD>
                <TD className="text-muted-foreground">{r.orderNumber ?? '—'}</TD>
                <TD className="text-muted-foreground">{ADDRESS_CATEGORY_LABEL[r.addressCategory]}</TD>
                <TD>
                  <PriorityBadge priority={r.priority} />
                </TD>
                <TD>
                  <Badge tone={ROW_STATUS[r.status].tone}>{ROW_STATUS[r.status].label}</Badge>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </div>

      {visible.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma linha neste filtro.</p>
      )}
    </div>
  );
}
