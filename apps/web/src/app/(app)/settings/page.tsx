'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui/spinner';

/** Raiz de Configurações — abre na primeira aba (Perfil). */
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/settings/profile');
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner className="h-6 w-6" />
    </div>
  );
}
