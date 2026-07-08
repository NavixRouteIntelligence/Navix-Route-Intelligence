'use client';

import type { ConnectorKind, ImportConnectorDescriptor } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plug, ScanLine, type LucideIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { importsApi } from '@/lib/api/imports';

const KIND: Record<ConnectorKind, { label: string; icon: LucideIcon }> = {
  file: { label: 'Arquivos', icon: FileText },
  capture: { label: 'Captura', icon: ScanLine },
  integration: { label: 'Integrações', icon: Plug },
};

const ORDER: ConnectorKind[] = ['file', 'capture', 'integration'];

function ConnectorChip({ c }: { c: ImportConnectorDescriptor }) {
  const available = c.status === 'available';
  return (
    <div
      className={`flex items-start justify-between gap-2 rounded-lg border border-border p-3 ${
        available ? 'bg-card' : 'bg-muted/30'
      }`}
    >
      <div className="min-w-0">
        <p className={`text-sm font-medium ${available ? '' : 'text-muted-foreground'}`}>{c.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
      </div>
      <Badge tone={available ? 'success' : 'neutral'}>{available ? 'Disponível' : 'Em breve'}</Badge>
    </div>
  );
}

/** Catálogo de conectores (disponíveis + planejados), agrupado por família. */
export function ConnectorCatalog() {
  const { data, isLoading } = useQuery({
    queryKey: ['import-connectors'],
    queryFn: () => importsApi.connectors(),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  const items = data?.data ?? [];
  const byKind = (k: ConnectorKind) => items.filter((c) => c.kind === k);

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div>
          <h3 className="text-sm font-semibold">Conectores</h3>
          <p className="text-xs text-muted-foreground">
            Fontes de importação. Novos conectores são plugáveis sem alterar o restante do módulo.
          </p>
        </div>
        {ORDER.map((kind) => {
          const list = byKind(kind);
          if (list.length === 0) return null;
          const { label, icon: Icon } = KIND[kind];
          return (
            <div key={kind} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => (
                  <ConnectorChip key={c.id} c={c} />
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
