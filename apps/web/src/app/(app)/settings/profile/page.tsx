'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-provider';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useProfile, useUpdateAvatar, useUpdateProfile } from '@/lib/settings/use-profile';

const TIME_ZONES = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Recife',
  'America/Bahia',
  'America/Fortaleza',
  'America/Belem',
  'America/Cuiaba',
  'America/Porto_Velho',
  'UTC',
  'America/New_York',
  'Europe/Lisbon',
  'Europe/Madrid',
];

const MAX_AVATAR_BYTES = 2_000_000;

const profileSchema = z.object({
  displayName: z.string().min(2, 'Mínimo 2 caracteres.').max(80),
  phone: z.string().max(20).optional(),
  jobTitle: z.string().max(80).optional(),
  timeZone: z.string().min(1),
});
type ProfileForm = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export default function SettingsProfilePage() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { toast } = useToast();
  const { profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileForm>({ resolver: zodResolver(profileSchema) });

  // Hidrata o formulário quando o perfil chega do servidor.
  useEffect(() => {
    if (profile) {
      reset({
        displayName: profile.displayName,
        phone: profile.phone ?? '',
        jobTitle: profile.jobTitle ?? '',
        timeZone: profile.timeZone,
      });
    }
  }, [profile, reset]);

  const onSaveProfile = (values: ProfileForm) =>
    updateProfile.mutate(
      {
        displayName: values.displayName,
        phone: values.phone?.trim() ? values.phone : null,
        jobTitle: values.jobTitle?.trim() ? values.jobTitle : null,
        timeZone: values.timeZone,
      },
      {
        onSuccess: () => toast({ tone: 'success', title: t('profile.saved') }),
        onError: (e: Error) =>
          toast({
            tone: 'error',
            title: t('profile.saveError'),
            description: e instanceof ApiError ? e.message : undefined,
          }),
      },
    );

  return (
    <div className="space-y-6">
      <AvatarCard displayName={profile?.displayName ?? user?.email ?? '—'} avatarUrl={profile?.avatarUrl ?? null} />

      {/* Dados pessoais */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.personal')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSaveProfile)} className="grid gap-4">
            <Field label={t('profile.displayName')} error={errors.displayName?.message} required>
              {(id) => <Input id={id} autoComplete="name" {...register('displayName')} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('profile.phone')} error={errors.phone?.message}>
                {(id) => <Input id={id} inputMode="tel" placeholder="+55 11 99999-8888" {...register('phone')} />}
              </Field>
              <Field label={t('profile.jobTitle')} error={errors.jobTitle?.message}>
                {(id) => <Input id={id} {...register('jobTitle')} />}
              </Field>
            </div>
            <Field label={t('profile.timeZone')} error={errors.timeZone?.message} required>
              {(id) => (
                <Select id={id} {...register('timeZone')}>
                  {TIME_ZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={updateProfile.isPending} disabled={!isDirty}>
                {t('profile.save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Informações da conta */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.info')}</CardTitle>
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

      <PasswordCard />
    </div>
  );
}

function AvatarCard({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  const { t } = useLocale();
  const { toast } = useToast();
  const updateAvatar = useUpdateAvatar();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  useEffect(() => setPreview(avatarUrl), [avatarUrl]);

  const initials = displayName
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  const onPick = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_AVATAR_BYTES) {
      toast({ tone: 'error', title: t('profile.saveError'), description: '≤ 2 MB' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setPreview(dataUrl);
      updateAvatar.mutate(dataUrl, {
        onSuccess: () => toast({ tone: 'success', title: t('profile.saved') }),
        onError: (e: Error) =>
          toast({
            tone: 'error',
            title: t('profile.saveError'),
            description: e instanceof ApiError ? e.message : undefined,
          }),
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.avatar')}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t('profile.avatar')} className="h-full w-full object-cover" />
          ) : (
            <span>{initials || '?'}</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} loading={updateAvatar.isPending}>
            {t('profile.avatar.change')}
          </Button>
          {preview && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setPreview(null);
                updateAvatar.mutate(null);
              }}
            >
              {t('profile.avatar.remove')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const { t } = useLocale();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const change = useMutation({
    mutationFn: (values: PasswordForm) =>
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
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.password')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => change.mutate(v))} className="grid gap-4">
          <Field label="Senha atual" error={errors.currentPassword?.message} required>
            {(id) => (
              <Input id={id} type="password" autoComplete="current-password" {...register('currentPassword')} />
            )}
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
