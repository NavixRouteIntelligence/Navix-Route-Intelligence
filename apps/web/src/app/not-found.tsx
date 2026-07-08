'use client';

import { FileQuestion } from 'lucide-react';
import Link from 'next/link';

import { StatusScreen } from '@/components/system/status-screen';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/locale-provider';

export default function NotFound() {
  const t = useT();
  return (
    <StatusScreen
      icon={FileQuestion}
      code="404"
      title={t('error.404.title')}
      description={t('error.404.description')}
      actions={
        <Button asChild>
          <Link href="/dashboard">{t('action.home')}</Link>
        </Button>
      }
    />
  );
}
