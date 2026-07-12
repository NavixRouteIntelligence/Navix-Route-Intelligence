'use client';

import { Bell, Building2, Plug, Shield, SlidersHorizontal, UserCircle, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/ui/page-header';
import { useAuth } from '@/lib/auth/auth-provider';
import { isAdmin } from '@/lib/auth/roles';
import type { TranslationKey } from '@/lib/i18n/dictionary';
import { useLocale } from '@/lib/i18n/locale-provider';
import { cn } from '@/lib/utils';

interface SettingsNavItem {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  /** Restrito a perfis administrativos (dados do tenant). */
  adminOnly?: boolean;
}

const NAV: SettingsNavItem[] = [
  { href: '/settings/profile', label: 'nav.profile', icon: UserCircle },
  { href: '/settings/preferences', label: 'settings.nav.preferences', icon: SlidersHorizontal },
  { href: '/settings/security', label: 'settings.nav.security', icon: Shield },
  { href: '/settings/notifications', label: 'settings.nav.notifications', icon: Bell },
  { href: '/settings/company', label: 'settings.nav.company', icon: Building2, adminOnly: true },
  { href: '/settings/integrations', label: 'settings.nav.integrations', icon: Plug, adminOnly: true },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const { user } = useAuth();
  const pathname = usePathname();
  const admin = isAdmin(user);
  const items = NAV.filter((item) => !item.adminOnly || admin);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />

      <div className="flex flex-col gap-6 md:flex-row">
        <nav
          aria-label={t('settings.title')}
          className="flex gap-1 overflow-x-auto md:w-56 md:shrink-0 md:flex-col md:overflow-visible"
        >
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {t(item.label)}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
