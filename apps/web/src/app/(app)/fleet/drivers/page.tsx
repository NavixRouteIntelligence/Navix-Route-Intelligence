'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { DRIVER_STATUSES, type Driver } from '@navix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
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
import { DriverStatusBadge } from '@/components/ui/status-badge';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { fleetApi } from '@/lib/api/fleet';

const schema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres.').max(120),
  licenseNumber: z.string().min(3, 'Mínimo 3 caracteres.').max(40),
  skills: z.string().optional(),
  status: z.enum(DRIVER_STATUSES as unknown as [string, ...string[]]),
});
type FormValues = z.infer<typeof schema>;

function parseSkills(input?: string): string[] {
  return (input ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function DriversPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [deleting, setDeleting] = useState<Driver | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => fleetApi.listDrivers({ pageSize: 100 }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['drivers'] });

  const save = useMutation({
    mutationFn: (values: FormValues) => {
      const body = {
        name: values.name,
        licenseNumber: values.licenseNumber,
        skills: parseSkills(values.skills),
        status: values.status,
      };
      return editing ? fleetApi.updateDriver(editing.id, body as never) : fleetApi.createDriver(body as never);
    },
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      toast({ tone: 'success', title: editing ? 'Motorista atualizado' : 'Motorista criado' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao salvar', description: e.message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fleetApi.deleteDriver(id),
    onSuccess: () => {
      invalidate();
      setDeleting(null);
      toast({ tone: 'success', title: 'Motorista excluído' });
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Erro ao excluir', description: e.message }),
  });

  const drivers = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Motoristas"
        description="Gerencie os motoristas da operação."
        action={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="h-4 w-4" />
            Novo motorista
          </Button>
        }
      />

      {error && <Alert tone="error" title="Erro ao carregar motoristas" />}

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum motorista"
          description="Cadastre o primeiro motorista."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4" />
              Novo motorista
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR>
                  <TH>Nome</TH>
                  <TH>CNH</TH>
                  <TH>Habilidades</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Ações</TH>
                </TR>
              </THead>
              <tbody>
                {drivers.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-muted-foreground">{d.licenseNumber}</TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        {d.skills.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          d.skills.map((s) => <Badge key={s}>{s}</Badge>)
                        )}
                      </div>
                    </TD>
                    <TD>
                      <DriverStatusBadge status={d.status} />
                    </TD>
                    <TD>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => { setEditing(d); setFormOpen(true); }}>
                          <Pencil className="h-4 w-4" />
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
      )}

      {formOpen && (
        <DriverFormDialog
          driver={editing}
          saving={save.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={(values) => save.mutate(values)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Excluir motorista"
        description={deleting ? `Remover ${deleting.name}? Esta ação não pode ser desfeita.` : ''}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

function DriverFormDialog({
  driver,
  saving,
  onCancel,
  onSubmit,
}: {
  driver: Driver | null;
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
      name: driver?.name ?? '',
      licenseNumber: driver?.licenseNumber ?? '',
      skills: driver?.skills.join(', ') ?? '',
      status: driver?.status ?? 'active',
    },
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()}>
      <DialogContent title={driver ? 'Editar motorista' : 'Novo motorista'}>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <Field label="Nome" error={errors.name?.message} required>
            {(id) => <Input id={id} {...register('name')} placeholder="Maria Souza" />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="CNH" error={errors.licenseNumber?.message} required>
              {(id) => <Input id={id} {...register('licenseNumber')} placeholder="CNH-12345" />}
            </Field>
            <Field label="Status" error={errors.status?.message}>
              {(id) => (
                <Select id={id} {...register('status')}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </Select>
              )}
            </Field>
          </div>
          <Field label="Habilidades" hint="Separe por vírgula (ex.: refrigerated, hazmat)">
            {(id) => <Input id={id} {...register('skills')} placeholder="refrigerated, hazmat" />}
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
