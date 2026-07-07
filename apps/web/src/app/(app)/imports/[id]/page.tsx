'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileWarning } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { ImportPreviewTable } from '@/components/imports/import-preview-table';
import { ImportSummaryCards } from '@/components/imports/import-summary-cards';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { importsApi } from '@/lib/api/imports';
import { BATCH_STATUS, FILE_TYPE_LABEL } from '@/lib/import-labels';
import { formatDateTime } from '@/lib/utils';

function toCsv(rows: { index: number; recipient: string | null; addressText: string; errors: string[] }[]): string {
  const header = 'linha,destinatario,endereco,erros';
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map(
    (r) => `${r.index},${esc(r.recipient ?? '')},${esc(r.addressText)},${esc(r.errors.join('; '))}`,
  );
  return [header, ...body].join('\n');
}

export default function ImportDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['imports', id],
    queryFn: () => importsApi.get(id),
    enabled: Boolean(id),
  });

  const downloadErrors = () => {
    if (!data) return;
    const invalid = data.rows.filter((r) => r.status === 'invalid');
    const blob = new Blob([toCsv(invalid)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `erros-${data.batch.filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const back = (
    <Button asChild variant="ghost" size="sm">
      <Link href="/imports">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
    </Button>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Importação" action={back} />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Importação" action={back} />
        <Alert tone="error" title="Não foi possível carregar esta importação." />
      </div>
    );
  }

  const { batch, rows } = data;
  const invalidRows = rows.filter((r) => r.status === 'invalid');

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.filename}
        description={`Importada em ${formatDateTime(batch.createdAt)}`}
        action={back}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{FILE_TYPE_LABEL[batch.fileType]}</Badge>
        <Badge tone={BATCH_STATUS[batch.status].tone}>{BATCH_STATUS[batch.status].label}</Badge>
        <span className="text-sm text-muted-foreground">{batch.createdDeliveries} entregas criadas</span>
        {batch.routePlanId && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/optimizer">Ver rota otimizada</Link>
          </Button>
        )}
      </div>

      <ImportSummaryCards summary={batch.summary} />

      {invalidRows.length > 0 && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <span className="flex items-center gap-2 text-sm">
              <FileWarning className="h-4 w-4 text-danger" aria-hidden />
              {invalidRows.length} {invalidRows.length === 1 ? 'registro inválido' : 'registros inválidos'}
            </span>
            <Button variant="outline" size="sm" onClick={downloadErrors}>
              <Download className="h-4 w-4" />
              Baixar relatório de erros (CSV)
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <ImportPreviewTable rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
