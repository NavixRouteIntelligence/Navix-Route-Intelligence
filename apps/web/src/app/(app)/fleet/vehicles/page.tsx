'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { VEHICLE_STATUSES, VEHICLE_TYPES, type Vehicle } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Truck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { VehicleStatusBadge } from '@/components/ui/status-badge';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { fleetApi } from '@/lib/api/fleet';
import { VEHICLE_TYPE_LABEL } from '@/lib/labels';

const schema = z.object({
  plate: z.string().min(3, 'Mínimo 3 caracteres.').max(20),
  type: z.enum(VEHICLE_TYPES as unknown as [string, ...string[]]),
  capacity: z.coerce.number().int().positive('Deve ser positivo.'),
  status: z.enum(VEHICLE_STATUSES as unknown as [string, ...string[]]),
});
type FormValues = z.infer<typeof schema>;

export default function VehiclesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => fleetApi.listVehicles({ pageSize: 100 }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['vehicles'] });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      editing
        ? fleetApi.updateVehicle(editing.id, values as never)
        : fleetApi.createVehicle(values as never),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      toast({ tone: 'success', title: editing ? 'Veículo atualizado' : 'Veículo criado' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao salvar', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fleetApi.deleteVehicle(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ tone: 'success', title: 'Veículo excluído' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao excluir', description: e.message }),
  });

  const vehicles = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veículos"
        description="Gerencie a frota de veículos."
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Novo veículo
          </Button>
        }
      />

      {error && <Alert tone="error" title="Erro ao carregar veículos" />}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum veículo"
          description="Cadastre o primeiro veículo da frota."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Novo veículo
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Placa</TH>
                  <TH>Tipo</TH>
                  <TH>Capacidade</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <tbody>
                {vehicles.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-medium">{v.plate}</TD>
                    <TD className="text-muted-foreground">{VEHICLE_TYPE_LABEL[v.type]}</TD>
                    <TD className="tabular-nums">{v.capacity}</TD>
                    <TD>
                      <VehicleStatusBadge status={v.status} />
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => { setEditing(v); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Excluir" onClick={() => setDeleting(v)}>
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
      )}

      {formOpen && (
        <VehicleFormDialog
          vehicle={editing}
          saving={save.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={(values) => save.mutate(values)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir veículo"
        description={deleting ? `Remover o veículo ${deleting.plate}? Esta ação não pode ser desfeita.` : ''}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function VehicleFormDialog({
  vehicle,
  saving,
  onCancel,
  onSubmit,
}: {
  vehicle: Vehicle | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      plate: vehicle?.plate ?? '',
      type: vehicle?.type ?? 'van',
      capacity: vehicle?.capacity ?? 100,
      status: vehicle?.status ?? 'active',
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent title={vehicle ? 'Editar veículo' : 'Novo veículo'}>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Placa" error={errors.plate?.message} required>
            {(id) => <Input id={id} {...register('plate')} placeholder="ABC1D23" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo" error={errors.type?.message}>
              {(id) => (
                <Select id={id} {...register('type')}>
                  {VEHICLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {VEHICLE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Capacidade" error={errors.capacity?.message} required>
              {(id) => <Input id={id} type="number" min={1} {...register('capacity')} />}
            </Field>
          </div>
          <Field label="Status" error={errors.status?.message}>
            {(id) => (
              <Select id={id} {...register('status')}>
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="maintenance">Manutenção</option>
              </Select>
            )}
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button type="submit" loading={saving}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
