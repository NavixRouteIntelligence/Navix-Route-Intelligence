'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';

const schema = z.object({
  tenantId: z.string().uuid('Tenant ID inválido.'),
  email: z.string().email('E-mail inválido.'),
  password: z.string().min(8, 'Mínimo de 8 caracteres.'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_TENANT = '019f335f-a2ae-7dd9-bcda-d458fe138c98';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tenantId: DEMO_TENANT, email: '', password: '' },
  });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await login(values);
      router.push('/dashboard');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Falha ao entrar.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse o painel da sua operação.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <Field label="Tenant ID" error={errors.tenantId?.message}>
            <Input {...register('tenantId')} placeholder="uuid do tenant" autoComplete="off" />
          </Field>
          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="voce@empresa.com" autoComplete="email" />
          </Field>
          <Field label="Senha" error={errors.password?.message}>
            <Input type="password" {...register('password')} placeholder="••••••••" autoComplete="current-password" />
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="w-full">
            Entrar
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/forgot-password" className="hover:text-foreground">
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
