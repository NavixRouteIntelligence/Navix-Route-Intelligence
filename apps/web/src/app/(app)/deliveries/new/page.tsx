'use client';

import type { CreateDeliveryRequest } from '@navix/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { DeliveryForm } from '@/components/deliveries/delivery-form';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { deliveriesApi } from '@/lib/api/deliveries';

export default function NewDeliveryPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const create = useMutation({
    mutationFn: (body: CreateDeliveryRequest) => deliveriesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deliveries'] });
      toast({ tone: 'success', title: 'Entrega criada' });
      router.push('/deliveries');
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao criar', description: e.message }),
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
        <PageHeader title="Nova entrega" description="Cadastre uma entrega para a operação." />
      </div>
      <DeliveryForm submitting={create.isPending} submitLabel="Criar entrega" onSubmit={(body) => create.mutate(body)} />
    </div>
  );
}
