'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { UiStoreProvider } from '@/components/layout/ui-store';
import { Forbidden } from '@/components/system/forbidden';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth/auth-provider';
import { isDriver } from '@/lib/auth/roles';

/** Rotas do Motorista Autônomo. Fleet e gestão de usuários seguem exclusivos da Empresa. */
const DRIVER_ALLOWED = ['/driver', '/imports', '/profile', '/settings'];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  // RBAC: motorista fica restrito ao seu conjunto de rotas; perfis
  // administrativos não acessam o painel do motorista. Acesso indevido → 403.
  const driver = isDriver(user);
  const onDriverRoute = pathname === '/driver' || pathname.startsWith('/driver/');
  const allowed = driver
    ? DRIVER_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    : !onDriverRoute;

  return (
    <UiStoreProvider>
      <a href="#main" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main id="main" className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl animate-fade-in">
              {allowed ? children : <Forbidden />}
            </div>
          </main>
        </div>
      </div>
    </UiStoreProvider>
  );
}
