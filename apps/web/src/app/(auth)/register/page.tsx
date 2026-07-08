'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AccountType } from '@navix/contracts';
import { Building2, User } from 'lucide-react';
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
import { homePath } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    accountType: z.enum(['driver', 'company']),
    name: z.string().min(2, 'Informe seu nome.'),
    email: z.string().email('E-mail inválido.'),
    password: z.string().min(8, 'Mínimo de 8 caracteres.'),
    organizationName: z.string().optional(),
  })
  .refine((v) => v.accountType !== 'company' || (v.organizationName?.trim().length ?? 0) >= 2, {
    message: 'Informe o nome da empresa.',
    path: ['organizationName'],
  });
type FormValues = z.infer<typeof schema>;

const TYPES: { value: AccountType; label: string; description: string; icon: typeof User }[] = [
  {
    value: 'driver',
    label: 'Motorista Autônomo',
    description: 'Conta pessoal com o painel do motorista.',
    icon: User,
  },
  {
    value: 'company',
    label: 'Empresa',
    description: 'Organização com painel administrativo e equipe.',
    icon: Building2,
  },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register: registerAccount } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { accountType: 'driver', name: '', email: '', password: '', organizationName: '' },
  });

  const accountType = watch('accountType');

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      const user = await registerAccount({
        accountType: values.accountType,
        name: values.name,
        email: values.email,
        password: values.password,
        organizationName: values.accountType === 'company' ? values.organizationName : undefined,
      });
      router.push(homePath(user));
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Falha ao criar a conta.');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Escolha o tipo de conta para começar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map((t) => {
              const Icon = t.icon;
              const active = accountType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setValue('accountType', t.value, { shouldValidate: true })}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-md',
                      active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.description}</span>
                </button>
              );
            })}
          </div>

          <Field label={accountType === 'company' ? 'Seu nome' : 'Nome completo'} error={errors.name?.message}>
            <Input {...register('name')} placeholder="Seu nome" autoComplete="name" />
          </Field>

          {accountType === 'company' && (
            <Field label="Nome da empresa" error={errors.organizationName?.message}>
              <Input {...register('organizationName')} placeholder="Sua empresa" autoComplete="organization" />
            </Field>
          )}

          <Field label="E-mail" error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="voce@email.com" autoComplete="email" />
          </Field>
          <Field label="Senha" error={errors.password?.message}>
            <Input type="password" {...register('password')} placeholder="••••••••" autoComplete="new-password" />
          </Field>

          {formError && (
            <p role="alert" className="text-sm text-danger">
              {formError}
            </p>
          )}

          <Button type="submit" loading={isSubmitting} className="w-full">
            Criar conta
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/login" className="font-medium text-primary hover:opacity-80">
              Entrar
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
