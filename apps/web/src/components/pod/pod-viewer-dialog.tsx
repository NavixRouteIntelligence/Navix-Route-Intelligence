'use client';

import { useQuery } from '@tanstack/react-query';

import { PodView } from '@/components/pod/pod-view';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { podApi } from '@/lib/api/pod';
import { FileCheck } from 'lucide-react';

/** Abre o comprovante de uma entrega (busca sob demanda). */
export function PodViewerDialog({
  deliveryId,
  open,
  onOpenChange,
}: {
  deliveryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['pod', deliveryId],
    queryFn: () => podApi.byDelivery(deliveryId as string),
    enabled: open && Boolean(deliveryId),
  });

  const pod = data?.data ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Comprovante de entrega" description="Foto, assinatura, GPS e observação.">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : pod ? (
          <PodView pod={pod} />
        ) : (
          <EmptyState icon={FileCheck} title="Sem comprovante" description="Esta entrega ainda não tem comprovante registrado." />
        )}
      </DialogContent>
    </Dialog>
  );
}
