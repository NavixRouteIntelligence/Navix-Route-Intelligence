'use client';

import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, FileCheck, UserX, XCircle } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { podApi } from '@/lib/api/pod';
import { formatDateTime } from '@/lib/utils';
import { POD_STATUS } from '@/lib/pod/labels';

/** Resumo de comprovantes (POD) por status + últimos registros. */
export function PodSummaryCard() {
  const summary = useQuery({ queryKey: ['pod-summary'], queryFn: () => podApi.summary() });
  const recent = useQuery({ queryKey: ['pod-recent'], queryFn: () => podApi.list({ pageSize: 5 }) });

  const s = summary.data;
  const items = recent.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-primary" aria-hidden />
          Comprovantes de entrega
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Mini icon={CheckCircle2} tone="text-success" label="Entregues" value={s?.delivered ?? 0} />
            <Mini icon={UserX} tone="text-warning" label="Ausentes" value={s?.absent ?? 0} />
            <Mini icon={XCircle} tone="text-danger" label="Recusados" value={s?.refused ?? 0} />
          </div>
        )}

        {items.length > 0 && (
          <ul className="space-y-1.5">
            {items.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/deliveries`} className="truncate text-muted-foreground hover:text-foreground">
                  {POD_STATUS[p.status].label} · {formatDateTime(p.recordedAt)}
                </Link>
                <span className={`h-2 w-2 shrink-0 rounded-full ${p.status === 'delivered' ? 'bg-success' : p.status === 'absent' ? 'bg-warning' : 'bg-danger'}`} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <Icon className={`mx-auto h-5 w-5 ${tone}`} aria-hidden />
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
