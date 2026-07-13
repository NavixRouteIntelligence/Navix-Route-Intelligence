'use client';

import { Building2 } from 'lucide-react';

import { ComingSoon } from '@/components/settings/coming-soon';
import { Forbidden } from '@/components/system/forbidden';
import { useAuth } from '@/lib/auth/auth-provider';
import { isAdmin } from '@/lib/auth/roles';
import { useLocale } from '@/lib/i18n/locale-provider';

export default function CompanySettingsPage() {
  const { t } = useLocale();
  const { user } = useAuth();
  if (!isAdmin(user)) return <Forbidden />;
  return <ComingSoon title={t('settings.nav.company')} icon={Building2} />;
}
