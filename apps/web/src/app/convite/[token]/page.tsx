'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, MailX } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { Spinner } from '@/components/ui/spinner';
import {
  acceptDriverInvite,
  fetchDriverInvite,
  InviteAcceptError,
  InviteNotFoundError,
} from '@/lib/api/driver-invite';
import { useAuth } from '@/lib/auth/auth-provider';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useT } from '@/lib/i18n/locale-provider';

type T = (key: TranslationKey) => string;

/**
 * O formulário muda conforme o convite: quando a frota já tem a ficha do
 * motorista, nome e CNH não são pedidos de novo. `requiresDriverDetails` vem
 * do backend — a página não adivinha.
 */
function buildSchema(t: T, requiresDriverDetails: boolean) {
  const base = z.object({
    password: z.string().min(8, t('invite.password.short')),
    passwordConfirm: z.string(),
    name: z.string().optional(),
    licenseNumber: z.string().optional(),
  });

  return base
    .refine((v) => v.password === v.passwordConfirm, {
      path: ['passwordConfirm'],
      message: t('invite.password.mismatch'),
    })
    .refine((v) => !requiresDriverDetails || (v.name ?? '').trim().length >= 2, {
      path: ['name'],
      message: t('invite.name.short'),
    })
    .refine((v) => !requiresDriverDetails || (v.licenseNumber ?? '').trim().length >= 3, {
      path: ['licenseNumber'],
      message: t('invite.license.short'),
    });
}

type FormValues = {
  password: string;
  passwordConfirm: string;
  name?: string;
  licenseNumber?: string;
};

/**
 * Página pública do convite de motorista (ADR-0085).
 *
 * O convidado ainda não tem conta — é o que ele vem criar —, então a página
 * roda fora de qualquer sessão. O token na URL é a credencial; o e-mail e a
 * empresa são **mostrados**, nunca escolhidos: quem os define é o convite.
 */
export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useT();
  const router = useRouter();
  const { login } = useAuth();
  const [accepted, setAccepted] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: ['driver-invite', token],
    queryFn: () => fetchDriverInvite(token),
    // Convite inválido não melhora com retry; falha de rede sim.
    retry: (count, err) => !(err instanceof InviteNotFoundError) && count < 2,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo className="h-7" />
        <h1 className="text-xl font-semibold">{t('invite.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('invite.subtitle')}</p>
      </header>

      {isPending ? (
        <div
          className="flex flex-col items-center gap-3 py-16 text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <Spinner />
          <p>{t('state.loading')}</p>
        </div>
      ) : error ? (
        <ErrorPanel notFound={error instanceof InviteNotFoundError} t={t} />
      ) : accepted ? (
        <section className="rounded-xl bg-success/10 p-6 text-center" role="status" aria-live="polite">
          <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
          <h2 className="mt-3 font-semibold">{t('invite.success.title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('invite.success.description')}</p>
        </section>
      ) : (
        <AcceptForm
          token={token}
          organizationName={data.organizationName}
          email={data.email}
          requiresDriverDetails={data.requiresDriverDetails}
          t={t}
          onAccepted={async (password) => {
            setAccepted(true);
            // O aceite cria a conta mas não emite sessão (o endpoint é público
            // — ver ADR-0085). Como o motorista acabou de escolher a senha,
            // entramos por ele: sem isto, ele digitaria tudo de novo.
            try {
              await login({ email: data.email, password });
              router.push('/driver');
            } catch {
              router.push('/login');
            }
          }}
        />
      )}

      <p className="mt-auto text-center text-xs text-muted-foreground">{t('invite.privacy')}</p>
    </main>
  );
}

function AcceptForm({
  token,
  organizationName,
  email,
  requiresDriverDetails,
  t,
  onAccepted,
}: {
  token: string;
  organizationName: string;
  email: string;
  requiresDriverDetails: boolean;
  t: T;
  onAccepted: (password: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(buildSchema(t, requiresDriverDetails)),
    defaultValues: { password: '', passwordConfirm: '', name: '', licenseNumber: '' },
  });

  const accept = useMutation({
    mutationFn: (values: FormValues) =>
      acceptDriverInvite(token, {
        password: values.password,
        ...(requiresDriverDetails
          ? { name: values.name?.trim(), licenseNumber: values.licenseNumber?.trim() }
          : {}),
      }),
    onSuccess: (_data, values) => onAccepted(values.password),
    onError: (e: Error) =>
      setFormError(
        e instanceof InviteNotFoundError
          ? t('invite.notFound.title')
          : e instanceof InviteAcceptError
            ? e.message
            : t('invite.error.description'),
      ),
  });

  return (
    <>
      <section className="flex items-center gap-3 rounded-xl border p-4">
        <BadgeCheck className="size-6 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{t('invite.org')}</p>
          <p className="truncate font-semibold">{organizationName}</p>
        </div>
      </section>

      <form
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          accept.mutate(values);
        })}
        className="grid gap-4"
        noValidate
      >
        <Field label={t('invite.email')} hint={t('invite.email.hint')}>
          {(id) => (
            <Input id={id} value={email} readOnly aria-readonly autoComplete="username" />
          )}
        </Field>

        {requiresDriverDetails ? (
          <>
            <Field label={t('invite.name')} error={errors.name?.message} required>
              {(id) => <Input id={id} {...register('name')} autoComplete="name" />}
            </Field>
            <Field
              label={t('invite.license')}
              hint={t('invite.license.hint')}
              error={errors.licenseNumber?.message}
              required
            >
              {(id) => <Input id={id} {...register('licenseNumber')} />}
            </Field>
          </>
        ) : null}

        <Field
          label={t('invite.password')}
          hint={t('invite.password.hint')}
          error={errors.password?.message}
          required
        >
          {(id) => (
            <Input id={id} type="password" {...register('password')} autoComplete="new-password" />
          )}
        </Field>
        <Field
          label={t('invite.password.confirm')}
          error={errors.passwordConfirm?.message}
          required
        >
          {(id) => (
            <Input
              id={id}
              type="password"
              {...register('passwordConfirm')}
              autoComplete="new-password"
            />
          )}
        </Field>

        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}

        <Button type="submit" loading={accept.isPending} className="w-full">
          {t('invite.submit')}
        </Button>
      </form>
    </>
  );
}

function ErrorPanel({ notFound, t }: { notFound: boolean; t: T }) {
  return (
    <section className="rounded-xl border p-6 text-center" role="alert">
      <MailX className="mx-auto size-8 text-muted-foreground" aria-hidden />
      <h2 className="mt-3 font-semibold">
        {t(notFound ? 'invite.notFound.title' : 'invite.error.title')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t(notFound ? 'invite.notFound.description' : 'invite.error.description')}
      </p>
    </section>
  );
}
