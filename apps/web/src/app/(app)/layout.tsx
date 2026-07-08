'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { UiStoreProvider } from '@/components/layout/ui-store';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth/auth-provider';
import { isDriver } from '@/lib/auth/roles';

/** Rotas que o Motorista Autônomo pode acessar. */
const DRIVER_ALLOWED = ['/driver', '/fleet/vehicles', '/profile'];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'guest') router.replace('/login');
  }, [status, router]);

  // Adapta o acesso por perfil (RBAC): motorista fica restrito ao seu conjunto
  // de rotas; perfis administrativos não acessam o painel do motorista.
  useEffect(() => {
    if (status !== 'authenticated') return;
    const driver = isDriver(user);
    if (driver && !DRIVER_ALLOWED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      router.replace('/driver');
    } else if (!driver && (pathname === '/driver' || pathname.startsWith('/driver/'))) {
      router.replace('/dashboard');
    }
  }, [status, user, pathname, router]);

  if (status !== 'authenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <UiStoreProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
          </main>
        </div>
      </div>
    </UiStoreProvider>
  );
}
