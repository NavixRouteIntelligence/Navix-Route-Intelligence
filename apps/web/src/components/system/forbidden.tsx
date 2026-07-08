'use client';

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';

import { StatusScreen } from '@/components/system/status-screen';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';
import { homePath } from '@/lib/auth/roles';
import { useT } from '@/lib/i18n/locale-provider';

/** Tela 403 — acesso negado por RBAC. Leva o usuário ao painel do seu perfil. */
export function Forbidden() {
  const t = useT();
  const { user } = useAuth();
  return (
    <StatusScreen
      icon={ShieldAlert}
      code="403"
      tone="warning"
      title={t('error.403.title')}
      description={t('error.403.description')}
      actions={
        <Button asChild>
          <Link href={homePath(user)}>{t('action.home')}</Link>
        </Button>
      }
    />
  );
}
