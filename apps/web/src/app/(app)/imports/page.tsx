'use client';

import type { ImportPreviewResponse } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, History, RotateCcw, Route as RouteIcon, Upload } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { ImportDropzone } from '@/components/imports/import-dropzone';
import { ImportPreviewTable } from '@/components/imports/import-preview-table';
import { ImportSummaryCards } from '@/components/imports/import-summary-cards';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { importsApi } from '@/lib/api/imports';
import { BATCH_STATUS, FILE_TYPE_LABEL } from '@/lib/import-labels';
import { formatDateTime } from '@/lib/utils';

export default function ImportsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [optimize, setOptimize] = useState(true);

  const history = useQuery({
    queryKey: ['imports', { page: 1 }],
    queryFn: () => importsApi.list({ page: 1, pageSize: 10 }),
  });

  const upload = useMutation({
    mutationFn: (file: File) => importsApi.preview(file),
    onSuccess: (res) => {
      setPreview(res);
      toast({ tone: 'success', title: 'Arquivo processado', description: `${res.rows.length} linhas lidas` });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Falha ao processar', description: e.message }),
  });

  const confirm = useMutation({
    mutationFn: () => importsApi.confirm(preview!.batch.id, { optimize }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      setPreview(null);
      toast({
        tone: 'success',
        title: 'Importação concluída',
        description: `${res.createdDeliveries} entregas criadas${res.routePlanId ? ' · rota otimizada' : ''}`,
      });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Falha na importação', description: e.message }),
  });

  const reset = () => {
    setPreview(null);
    upload.reset();
  };

  const items = history.data?.data ?? [];
  const validCount = preview?.batch.summary.valid ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Center"
        description="Importe entregas de CSV, Excel ou PDF com detecção automática, validação e geocodificação."
      />

      {!preview && (
        <Card>
          <CardContent className="pt-6">
            {upload.isPending ? (
              <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
                <Spinner />
                Lendo arquivo, detectando colunas e geocodificando…
              </div>
            ) : (
              <ImportDropzone onFile={(f) => upload.mutate(f)} disabled={upload.isPending} />
            )}
          </CardContent>
        </Card>
      )}

      {preview && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="primary">{FILE_TYPE_LABEL[preview.batch.fileType]}</Badge>
              <span className="text-sm font-medium">{preview.batch.filename}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              Recomeçar
            </Button>
          </div>

          <ImportSummaryCards summary={preview.batch.summary} />

          {validCount === 0 && (
            <Alert tone="warning" title="Nenhuma entrega válida para importar">
              Revise os erros abaixo e envie um arquivo corrigido.
            </Alert>
          )}

          <Card>
            <CardContent className="pt-6">
              <ImportPreviewTable rows={preview.rows} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={optimize}
                  onChange={(e) => setOptimize(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <RouteIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                Otimizar rota automaticamente após importar
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={reset} disabled={confirm.isPending}>
                  Cancelar
                </Button>
                <Button onClick={() => confirm.mutate()} disabled={confirm.isPending || validCount === 0}>
                  {confirm.isPending ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  Confirmar importação ({validCount})
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Histórico */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-h3">Histórico de importações</h2>
        </div>

        {history.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Upload}
            title="Nenhuma importação ainda"
            description="Envie seu primeiro arquivo para começar."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Arquivo</TH>
                    <TH>Data</TH>
                    <TH>Válidas</TH>
                    <TH>Entregas</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Detalhes</TH>
                  </TR>
                </THead>
                <tbody>
                  {items.map((b) => (
                    <TR key={b.id}>
                      <TD>
                        <span className="flex items-center gap-2">
                          <Badge tone="neutral">{FILE_TYPE_LABEL[b.fileType]}</Badge>
                          <span className="font-medium">{b.filename}</span>
                        </span>
                      </TD>
                      <TD className="text-muted-foreground">{formatDateTime(b.createdAt)}</TD>
                      <TD className="tabular-nums">{b.summary.valid}/{b.summary.total}</TD>
                      <TD className="tabular-nums">{b.createdDeliveries}</TD>
                      <TD>
                        <Badge tone={BATCH_STATUS[b.status].tone}>{BATCH_STATUS[b.status].label}</Badge>
                      </TD>
                      <TD className="text-right">
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/imports/${b.id}`}>Ver</Link>
                        </Button>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
