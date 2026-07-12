'use client';

import { Bell } from 'lucide-react';

import { ComingSoon } from '@/components/settings/coming-soon';
import { useLocale } from '@/lib/i18n/locale-provider';

export default function NotificationsSettingsPage() {
  const { t } = useLocale();
  return <ComingSoon title={t('settings.nav.notifications')} icon={Bell} />;
}
