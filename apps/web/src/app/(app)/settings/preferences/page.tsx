'use client';

import type { UpdateUserSettingsRequest } from '@navix/contracts';
import { Monitor, Moon, Sun } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import { LOCALES } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { useSettings, useUpdateSettings } from '@/lib/settings/use-settings';
import { cn } from '@/lib/utils';

const THEMES = [
  { value: 'light', icon: Sun, key: 'settings.theme.light' as const },
  { value: 'dark', icon: Moon, key: 'settings.theme.dark' as const },
  { value: 'system', icon: Monitor, key: 'settings.theme.system' as const },
] as const;

export default function PreferencesPage() {
  const { t } = useLocale();
  const { toast } = useToast();
  const { settings } = useSettings();
  const update = useUpdateSettings();

  const patch = (values: UpdateUserSettingsRequest) =>
    update.mutate(values, {
      onError: () => toast({ tone: 'error', title: t('settings.saveError') }),
    });

  return (
    <div className="space-y-6">
      {/* Tema */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div role="radiogroup" aria-label={t('settings.theme')} className="flex flex-wrap gap-2">
            {THEMES.map((th) => {
              const Icon = th.icon;
              const active = settings.theme === th.value;
              return (
                <OptionButton key={th.value} active={active} onClick={() => patch({ theme: th.value })}>
                  <Icon className="h-4 w-4" aria-hidden />
                  {t(th.key)}
                </OptionButton>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Idioma */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.language')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label={t('settings.language')}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {LOCALES.map((l) => (
              <OptionButton
                key={l.value}
                active={settings.locale === l.value}
                onClick={() => patch({ locale: l.value })}
              >
                <span aria-hidden>{l.flag}</span>
                <span className="truncate">{l.label}</span>
              </OptionButton>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Exibição */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.density')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div role="radiogroup" aria-label={t('settings.density')} className="flex flex-wrap gap-2">
            <OptionButton active={settings.density === 'comfortable'} onClick={() => patch({ density: 'comfortable' })}>
              {t('settings.density.comfortable')}
            </OptionButton>
            <OptionButton active={settings.density === 'compact'} onClick={() => patch({ density: 'compact' })}>
              {t('settings.density.compact')}
            </OptionButton>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.timeFormat')}</p>
            <div role="radiogroup" aria-label={t('settings.timeFormat')} className="flex flex-wrap gap-2">
              <OptionButton active={settings.timeFormat === '24h'} onClick={() => patch({ timeFormat: '24h' })}>
                24h
              </OptionButton>
              <OptionButton active={settings.timeFormat === '12h'} onClick={() => patch({ timeFormat: '12h' })}>
                12h
              </OptionButton>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">{t('settings.weekStart')}</p>
            <div role="radiogroup" aria-label={t('settings.weekStart')} className="flex flex-wrap gap-2">
              <OptionButton active={settings.weekStart === 'monday'} onClick={() => patch({ weekStart: 'monday' })}>
                {t('settings.weekStart.monday')}
              </OptionButton>
              <OptionButton active={settings.weekStart === 'sunday'} onClick={() => patch({ weekStart: 'sunday' })}>
                {t('settings.weekStart.sunday')}
              </OptionButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferências de interface */}
      <Card>
        <CardHeader>
          <CardTitle>{t('profile.tab.preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <PrefRow
            label={t('settings.pref.reducedMotion')}
            hint={t('settings.pref.reducedMotion.hint')}
            checked={settings.reducedMotion}
            onChange={(v) => patch({ reducedMotion: v })}
          />
          <PrefRow
            label={t('settings.pref.compact')}
            hint={t('settings.pref.compact.hint')}
            checked={settings.compact}
            onChange={(v) => patch({ compact: v })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function OptionButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/50',
      )}
    >
      {children}
    </button>
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
