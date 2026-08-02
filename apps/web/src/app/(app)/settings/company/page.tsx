'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, KeyRound, Palette } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Forbidden } from '@/components/system/forbidden';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { useToast } from '@/components/ui/toast';
import { ApiError } from '@/lib/api/client';
import { enterpriseApi } from '@/lib/api/enterprise';
import { useAuth } from '@/lib/auth/auth-provider';
import { isAdmin } from '@/lib/auth/roles';
import { useBranding } from '@/lib/branding/branding-provider';

const schema = z.object({
  displayName: z.string().min(2, 'Mínimo de 2 caracteres.').max(80),
  logoUrl: z.union([
    z.literal(''),
    z.string().url('URL inválida.').startsWith('https://', 'Use HTTPS.'),
  ]),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use #RRGGBB.'),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use #RRGGBB.'),
  customDomain: z.union([
    z.literal(''),
    z
      .string()
      .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i, 'Domínio inválido.'),
  ]),
});
type FormValues = z.infer<typeof schema>;

export default function CompanySettingsPage() {
  const { user } = useAuth();
  const { refresh } = useBranding();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['enterprise', 'branding'],
    queryFn: enterpriseApi.getBranding,
  });
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const branding = query.data?.data;
    if (!branding) return;
    reset({
      displayName: branding.displayName,
      logoUrl: branding.logoUrl ?? '',
      primaryColor: branding.primaryColor,
      accentColor: branding.accentColor,
      customDomain: branding.customDomain ?? '',
    });
  }, [query.data, reset]);

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      enterpriseApi.updateBranding({
        displayName: values.displayName,
        logoUrl: values.logoUrl || null,
        primaryColor: values.primaryColor,
        accentColor: values.accentColor,
        customDomain: values.customDomain || null,
      }),
    onSuccess: async (response) => {
      queryClient.setQueryData(['enterprise', 'branding'], response);
      reset({
        displayName: response.data.displayName,
        logoUrl: response.data.logoUrl ?? '',
        primaryColor: response.data.primaryColor,
        accentColor: response.data.accentColor,
        customDomain: response.data.customDomain ?? '',
      });
      await refresh();
      toast({ tone: 'success', title: 'Identidade da empresa atualizada.' });
    },
    onError: showError,
  });

  const verify = useMutation({
    mutationFn: enterpriseApi.verifyDomain,
    onSuccess: (response) => {
      queryClient.setQueryData(['enterprise', 'branding'], response);
      toast({ tone: 'success', title: 'Domínio verificado.' });
    },
    onError: showError,
  });

  function showError(error: Error) {
    toast({
      tone: 'error',
      title: 'Não foi possível guardar.',
      description: error instanceof ApiError ? error.message : undefined,
    });
  }

  if (!isAdmin(user)) return <Forbidden />;
  if (query.isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-6 w-6" />
      </div>
    );
  if (query.error || !query.data) {
    return <Alert tone="error" title="Não foi possível carregar a identidade da empresa." />;
  }

  const branding = query.data.data;
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" aria-hidden />
          <h1 className="text-h2 font-semibold">Empresa e marca</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Personalização Enterprise aplicada ao painel e às páginas de acesso.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Identidade visual
          </CardTitle>
          <CardDescription>
            Logo em HTTPS e cores acessíveis no formato hexadecimal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit((values) => save.mutate(values))} className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da marca" error={errors.displayName?.message} required>
                {(id) => <Input id={id} {...register('displayName')} />}
              </Field>
              <Field label="URL do logo" error={errors.logoUrl?.message}>
                {(id) => (
                  <Input
                    id={id}
                    placeholder="https://cdn.empresa.pt/logo.svg"
                    {...register('logoUrl')}
                  />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField
                label="Cor principal"
                name="primaryColor"
                value={watch('primaryColor')}
                register={register}
                error={errors.primaryColor?.message}
              />
              <ColorField
                label="Cor de destaque"
                name="accentColor"
                value={watch('accentColor')}
                register={register}
                error={errors.accentColor?.message}
              />
            </div>
            <Field label="Domínio próprio" error={errors.customDomain?.message}>
              {(id) => (
                <Input id={id} placeholder="entregas.empresa.pt" {...register('customDomain')} />
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={save.isPending} disabled={!isDirty}>
                Guardar identidade
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Domínio próprio</CardTitle>
            <DomainStatus status={branding.customDomainStatus} />
          </div>
          <CardDescription>
            Somente um domínio cuja posse foi comprovada passa a resolver esta marca.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {branding.domainVerification ? (
            <>
              <Alert tone="warning" title="Adicione um registro DNS TXT">
                <p className="font-mono text-xs break-all">{branding.domainVerification.name}</p>
                <p className="font-mono text-xs break-all">{branding.domainVerification.value}</p>
              </Alert>
              <Button
                variant="secondary"
                onClick={() => verify.mutate()}
                loading={verify.isPending}
              >
                Verificar DNS
              </Button>
            </>
          ) : branding.customDomainStatus === 'verified' ? (
            <Alert tone="success" title={`${branding.customDomain} está verificado.`} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Informe um domínio acima para iniciar a verificação.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> SSO corporativo
          </CardTitle>
          <CardDescription>Base preparada para SAML 2.0 e OpenID Connect.</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert title="Integração protegida por adaptador">
            Os fluxos permanecem desativados até configurar metadados, assinatura, PKCE e mapeamento
            de grupos com um provedor aprovado.
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

function ColorField({
  label,
  name,
  value,
  register,
  error,
}: {
  label: string;
  name: 'primaryColor' | 'accentColor';
  value?: string;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  error?: string;
}) {
  return (
    <Field label={label} error={error} required>
      {(id) => (
        <div className="flex gap-2">
          <span
            className="h-10 w-10 shrink-0 rounded-md border border-border"
            style={{ backgroundColor: value }}
            aria-hidden
          />
          <Input id={id} className="font-mono uppercase" {...register(name)} />
        </div>
      )}
    </Field>
  );
}

function DomainStatus({ status }: { status: 'not_configured' | 'pending' | 'verified' }) {
  if (status === 'verified') return <Badge tone="success">Verificado</Badge>;
  if (status === 'pending') return <Badge tone="warning">Pendente</Badge>;
  return <Badge>Não configurado</Badge>;
}
