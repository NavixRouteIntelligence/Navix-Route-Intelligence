'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/** Lê valores de CSS variables (tokens do DS) e reage à troca de tema. */
export function useTokenColors(names: string[]): string[] {
  const { resolvedTheme } = useTheme();
  const [colors, setColors] = useState<string[]>(() => names.map(() => 'hsl(250 84% 60%)'));
  useEffect(() => {
    const styles = getComputedStyle(document.documentElement);
    setColors(names.map((n) => `hsl(${styles.getPropertyValue(n).trim()})`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme]);
  return colors;
}
