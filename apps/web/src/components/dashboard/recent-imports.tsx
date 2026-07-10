'use client';

import type { ImportBatchStatus, ImportBatchView } from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Upload } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { importsApi } from '@/lib/api/imports';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
const STATUS: Record<ImportBatchStatus, { label: string; tone: Tone }> = {
  preview: { label: 'Prévia', tone: 'warning' },
  imported: { label: 'Importado', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
};

/** Importações recentes (arquivo, válidas/total, status). */
export function RecentImports() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['imports', 'dashboard'],
    queryFn: () => importsApi.list({ pageSize: 4 }),
  });
  const items: ImportBatchView[] = data?.data ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Import Center — recentes</CardTitle>
        <Link href="/imports" className="inline-flex items-center gap-1 text-sm text-primary hover:opacity-80">
          Importar
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : error || items.length === 0 ? (
          <EmptyState icon={Upload} title="Sem importações" description="Importe planilhas ou PDFs de rotas." />
        ) : (
          items.map((b) => {
            const st = STATUS[b.status];
            return (
              <div key={b.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.filename}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {b.summary.valid}/{b.summary.total} válidas
                  </p>
                </div>
                <Badge tone={st.tone}>{st.label}</Badge>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
