'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/toast';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';

const schema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });
type FormValues = z.infer<typeof schema>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const change = useMutation({
    mutationFn: (values: FormValues) =>
      authApi.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      toast({ tone: 'success', title: 'Senha alterada' });
      reset();
    },
    onError: (e: Error) =>
      toast({
        tone: 'error',
        title: 'Erro ao alterar senha',
        description: e instanceof ApiError ? e.message : undefined,
      }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Perfil" description="Seus dados de acesso e segurança." />

      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Info label="E-mail" value={user?.email ?? '—'} />
          <Info label="Tenant" value={user?.tenantId ?? '—'} mono />
          <div className="sm:col-span-2">
            <p className="text-sm text-muted-foreground">Papéis</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {(user?.roles ?? []).map((r) => (
                <Badge key={r} tone="primary">
                  {r}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((v) => change.mutate(v))} className="grid gap-4">
            <Field label="Senha atual" error={errors.currentPassword?.message} required>
              {(id) => <Input id={id} type="password" {...register('currentPassword')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nova senha" error={errors.newPassword?.message} required>
                {(id) => <Input id={id} type="password" {...register('newPassword')} />}
              </Field>
              <Field label="Confirmar nova senha" error={errors.confirm?.message} required>
                {(id) => <Input id={id} type="password" {...register('confirm')} />}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" loading={change.isPending}>
                Alterar senha
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={mono ? 'font-mono text-sm' : 'text-sm font-medium'}>{value}</p>
    </div>
  );
}
