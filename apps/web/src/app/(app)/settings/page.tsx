'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/lib/auth/auth-provider';
import { LOCALES, type Locale } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { usePreferences } from '@/lib/preferences/preferences-provider';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', icon: Sun, key: 'settings.theme.light' as const },
  { value: 'dark', icon: Moon, key: 'settings.theme.dark' as const },
  { value: 'system', icon: Monitor, key: 'settings.theme.system' as const },
];

export default function SettingsPage() {
  const { t, locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const { preferences, setPreference } = usePreferences();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.appearance')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.theme')}</p>
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
                      active
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    {t(th.key)}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Idioma */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('settings.language')} className="flex flex-wrap gap-2">
            {LOCALES.map((l) => {
              const active = locale === l.value;
              return (
                <button
                  key={l.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setLocale(l.value as Locale)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  {l.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Empresa (read-only — apenas dados disponíveis via API) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.company')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label={t('settings.company.email')} value={user?.email ?? '—'} />
          <Row label={t('settings.company.tenant')} value={user?.tenantId ?? '—'} mono />
          <Row label={t('settings.company.roles')} value={user?.roles.join(', ') ?? '—'} />
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.preferences')}</CardTitle>
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
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn('font-medium', mono && 'font-mono text-xs')}>{value}</span>
    </div>
  );
}

function PrefRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
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
