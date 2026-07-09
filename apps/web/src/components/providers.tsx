'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, type ReactNode } from 'react';

import { OfflineOverlay } from '@/components/system/offline-overlay';
import { ToastProvider } from '@/components/ui/toast';
import { AuthProvider } from '@/lib/auth/auth-provider';
import { LocaleProvider } from '@/lib/i18n/locale-provider';
import { PreferencesProvider } from '@/lib/preferences/preferences-provider';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <LocaleProvider>
        <PreferencesProvider>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
              <OfflineOverlay />
            </ToastProvider>
          </QueryClientProvider>
        </PreferencesProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}
