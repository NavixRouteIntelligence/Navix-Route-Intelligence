'use client';

import { Shield } from 'lucide-react';

import { ComingSoon } from '@/components/settings/coming-soon';
import { useLocale } from '@/lib/i18n/locale-provider';

export default function SecuritySettingsPage() {
  const { t } = useLocale();
  return <ComingSoon title={t('settings.nav.security')} icon={Shield} />;
}
