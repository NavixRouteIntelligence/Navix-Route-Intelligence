'use client';

import type { CreateDeliveryRequest } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { DeliveryForm } from '@/components/deliveries/delivery-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';

export default function EditDeliveryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => deliveriesApi.get(id),
  });

  const update = useMutation({
    mutationFn: (body: CreateDeliveryRequest) => deliveriesApi.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      qc.invalidateQueries({ queryKey: ['delivery', id] });
      toast({ tone: 'success', title: 'Entrega atualizada' });
      router.push('/deliveries');
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao salvar', description: e.message }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/deliveries">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <PageHeader title="Editar entrega" description="Atualize os dados da entrega." />
      </div>

      {error && <Alert tone="error" title="Entrega não encontrada" />}
      {isLoading ? (
        <Skeleton className="h-96 w-full" />
      ) : data ? (
        <DeliveryForm
          delivery={data.data}
          submitting={update.isPending}
          submitLabel="Salvar alterações"
          onSubmit={(body) => update.mutate(body)}
        />
      ) : null}
    </div>
  );
}
