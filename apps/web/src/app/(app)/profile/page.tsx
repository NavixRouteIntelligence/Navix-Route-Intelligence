'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { LOCALES, type Locale } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { usePreferences } from '@/lib/preferences/preferences-provider';
import { cn } from '@/lib/utils';

const schema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { message: 'As senhas não coincidem.', path: ['confirm'] });
type FormValues = z.infer<typeof schema>;

const THEMES = [
  { value: 'light', icon: Sun, key: 'settings.theme.light' as const },
  { value: 'dark', icon: Moon, key: 'settings.theme.dark' as const },
  { value: 'system', icon: Monitor, key: 'settings.theme.system' as const },
];

export default function ProfilePage() {
  const { t } = useLocale();
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
      toast({ tone: 'error', title: 'Erro ao alterar senha', description: e instanceof ApiError ? e.message : undefined }),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">{t('profile.tab.account')}</TabsTrigger>
          <TabsTrigger value="appearance">{t('profile.tab.appearance')}</TabsTrigger>
          <TabsTrigger value="preferences">{t('profile.tab.preferences')}</TabsTrigger>
        </TabsList>

        {/* Conta */}
        <TabsContent value="account" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.tab.account')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Info label={t('settings.company.email')} value={user?.email ?? '—'} />
              <Info label={t('settings.company.tenant')} value={user?.tenantId ?? '—'} mono />
              <div className="sm:col-span-2">
                <p className="text-sm text-muted-foreground">{t('settings.company.roles')}</p>
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
              <CardTitle>{t('profile.password')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit((v) => change.mutate(v))} className="grid gap-4">
                <Field label="Senha atual" error={errors.currentPassword?.message} required>
                  {(id) => <Input id={id} type="password" autoComplete="current-password" {...register('currentPassword')} />}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nova senha" error={errors.newPassword?.message} required>
                    {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('newPassword')} />}
                  </Field>
                  <Field label="Confirmar nova senha" error={errors.confirm?.message} required>
                    {(id) => <Input id={id} type="password" autoComplete="new-password" {...register('confirm')} />}
                  </Field>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" loading={change.isPending}>
                    {t('profile.password')}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aparência */}
        <TabsContent value="appearance" className="space-y-6">
          <ThemeAndLanguage />
        </TabsContent>

        {/* Preferências */}
        <TabsContent value="preferences">
          <PreferencesCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ThemeAndLanguage() {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('settings.theme')} className="flex flex-wrap gap-2">
            {THEMES.map((th) => {
              const Icon = th.icon;
              const active = mounted && theme === th.value;
              return (
                <button
                  key={th.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setTheme(th.value)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    active ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(th.key)}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('settings.language')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LOCALES.map((l) => {
              const active = locale === l.value;
              return (
                <button
                  key={l.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLocale(l.value as Locale)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                    active ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <span aria-hidden>{l.flag}</span>
                  <span className="truncate">{l.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function PreferencesCard() {
  const { t } = useLocale();
  const { preferences, setPreference } = usePreferences();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.tab.preferences')}</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        <PrefRow
          label={t('settings.pref.reducedMotion')}
          hint={t('settings.pref.reducedMotion.hint')}
          checked={preferences.reducedMotion}
          onChange={(v) => setPreference('reducedMotion', v)}
        />
        <PrefRow
          label={t('settings.pref.compact')}
          hint={t('settings.pref.compact.hint')}
          checked={preferences.compact}
          onChange={(v) => setPreference('compact', v)}
        />
      </CardContent>
    </Card>
  );
}

function PrefRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} label={label} />
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
