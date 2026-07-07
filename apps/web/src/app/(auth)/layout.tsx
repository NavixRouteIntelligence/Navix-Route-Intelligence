import Link from 'next/link';
import type { ReactNode } from 'react';

import { Logo } from '@/components/ui/logo';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center" aria-label="Navix">
          <Logo />
        </Link>
        {children}
      </div>
    </main>
  );
}
