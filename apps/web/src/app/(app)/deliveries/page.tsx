'use client';

import {
  DELIVERY_PRIORITIES,
  DELIVERY_STATUSES,
  type Delivery,
  type DeliveryPriority,
  type DeliveryStatus,
} from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Package, Pencil, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PriorityBadge } from '@/components/ui/status-badge';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 10;
const STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  in_route: 'Em rota',
  delivered: 'Entregue',
  failed: 'Falhou',
  canceled: 'Cancelada',
};
const PRIORITY_LABEL: Record<DeliveryPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export default function DeliveriesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DeliveryStatus | ''>('');
  const [priority, setPriority] = useState<DeliveryPriority | ''>('');
  const [deleting, setDeleting] = useState<Delivery | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['deliveries', { page, status, priority }],
    queryFn: () =>
      deliveriesApi.list({
        page,
        pageSize: PAGE_SIZE,
        status: status || undefined,
        priority: priority || undefined,
        sort: '-createdAt',
      }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['deliveries'] });

  const changeStatus = useMutation({
    mutationFn: ({ id, next }: { id: string; next: DeliveryStatus }) => deliveriesApi.changeStatus(id, next),
    onSuccess: () => {
      invalidate();
      toast({ tone: 'success', title: 'Status atualizado' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Transição inválida', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deliveriesApi.remove(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ tone: 'success', title: 'Entrega excluída' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao excluir', description: e.message }),
  });

  const items = data?.data ?? [];
  const total = data?.meta.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Entregas"
        description="Cadastre e acompanhe as entregas."
        action={
          <Button asChild>
            <Link href="/deliveries/new">
              <Plus className="h-4 w-4" />
              Nova entrega
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={status}
              onChange={(e) => { setStatus(e.target.value as DeliveryStatus | ''); setPage(1); }}
              className="w-44"
            >
              <option value="">Todos</option>
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
            <Select
              value={priority}
              onChange={(e) => { setPriority(e.target.value as DeliveryPriority | ''); setPage(1); }}
              className="w-44"
            >
              <option value="">Todas</option>
              {DELIVERY_PRIORITIES.map((p) => (
                <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {error && <Alert tone="error" title="Erro ao carregar entregas" />}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma entrega"
          description="Ajuste os filtros ou cadastre uma nova entrega."
          action={
            <Button asChild>
              <Link href="/deliveries/new">
                <Plus className="h-4 w-4" />
                Nova entrega
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Endereço</TH>
                    <TH>Prioridade</TH>
                    <TH>Status</TH>
                    <TH>Janela</TH>
                    <TH className="text-right">Ações</TH>
                  </TR>
                </THead>
                <tbody>
                  {items.map((d) => (
                    <TR key={d.id}>
                      <TD>
                        <p className="font-medium">{d.address.city}</p>
                        <p className="text-muted-foreground">
                          {d.address.street}, {d.address.number}
                        </p>
                      </TD>
                      <TD>
                        <PriorityBadge priority={d.priority} />
                      </TD>
                      <TD>
                        <Select
                          value={d.status}
                          onChange={(e) => changeStatus.mutate({ id: d.id, next: e.target.value as DeliveryStatus })}
                          className="h-8 w-36"
                        >
                          {DELIVERY_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                          ))}
                        </Select>
                      </TD>
                      <TD className="text-muted-foreground">{formatDateTime(d.timeWindow.start)}</TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button asChild variant="ghost" size="icon" aria-label="Editar">
                            <Link href={`/deliveries/${d.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setDeleting(d)}>
                            <Trash2 className="h-4 w-4 text-danger" />
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} {total === 1 ? 'entrega' : 'entregas'} · página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir entrega"
        description="A entrega será removida (exclusão lógica)."
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}
