'use client';

import { LogOut } from 'lucide-react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-provider';

export function Topbar() {
  const { user, logout } = useAuth();
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div className="text-sm text-muted-foreground">
        {user ? (
          <span>
            <span className="text-foreground font-medium">{user.email}</span>
            {user.roles.length > 0 && <span className="ml-2">· {user.roles.join(', ')}</span>}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={() => void logout()}>
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </header>
  );
}
