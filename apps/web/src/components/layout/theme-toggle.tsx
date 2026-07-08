'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  const label = isDark ? 'Ativar modo claro' : 'Ativar modo escuro';
  return (
    <Tooltip label={label} side="bottom">
      <Button variant="ghost" size="icon" aria-label={label} onClick={() => setTheme(isDark ? 'light' : 'dark')}>
        {mounted && isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </Button>
    </Tooltip>
  );
}
