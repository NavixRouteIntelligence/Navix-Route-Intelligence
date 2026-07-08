'use client';

import { AlertOctagon } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';

import { StatusScreen } from '@/components/system/status-screen';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n/locale-provider';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    // Ponto de integração para telemetria de erros (ex.: Sentry) no futuro.
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon={AlertOctagon}
      code="500"
      tone="danger"
      title={t('error.500.title')}
      description={t('error.500.description')}
      actions={
        <>
          <Button onClick={() => reset()}>{t('state.retry')}</Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">{t('action.home')}</Link>
          </Button>
        </>
      }
    />
  );
}
