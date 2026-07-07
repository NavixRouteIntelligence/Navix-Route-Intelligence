'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { RoutePlanView } from '@/components/optimizer/route-plan-view';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { optimizerApi } from '@/lib/api/optimizer';
import { formatDateTime } from '@/lib/utils';

export default function RoutePlanDetailPage() {
  const params = useParams<{ id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['route-plan', params.id],
    queryFn: () => optimizerApi.getPlan(params.id),
  });

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/optimizer">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <PageHeader
          title="Route Plan"
          description={data ? `Otimizado em ${formatDateTime(data.data.createdAt)}` : undefined}
        />
      </div>

      {error && <Alert tone="error" title="Route Plan não encontrado" />}
      {isLoading ? <Skeleton className="h-96 w-full" /> : data ? <RoutePlanView plan={data.data} /> : null}
    </div>
  );
}
