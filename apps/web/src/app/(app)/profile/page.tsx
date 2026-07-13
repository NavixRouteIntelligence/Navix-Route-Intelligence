'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Spinner } from '@/components/ui/spinner';

/** Perfil foi consolidado na área de Configurações — redireciona para a aba. */
export default function ProfileRedirect() {
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
