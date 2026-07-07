'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/lib/auth/auth-provider';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
