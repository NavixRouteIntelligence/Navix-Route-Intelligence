'use client';

import { Plug } from 'lucide-react';

import { ComingSoon } from '@/components/settings/coming-soon';
import { Forbidden } from '@/components/system/forbidden';
import { useAuth } from '@/lib/auth/auth-provider';
import { isAdmin } from '@/lib/auth/roles';
import { useLocale } from '@/lib/i18n/locale-provider';

export default function IntegrationsSettingsPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  if (!isAdmin(user)) return <Forbidden />;
  return <ComingSoon title={t('settings.nav.integrations')} icon={Plug} />;
}
