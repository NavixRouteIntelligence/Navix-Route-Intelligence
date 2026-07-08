'use client';

import { useId, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Side = 'top' | 'bottom' | 'left' | 'right';

const SIDE: Record<Side, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/**
 * Tooltip acessível e sem dependências. Aparece no hover E no foco por teclado
 * (WCAG), e é associado ao gatilho por `aria-describedby`. O conteúdo do gatilho
 * deve ser focável (botão/link) para leitores de tela.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  side?: Side;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined}>{children}</span>
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 w-max max-w-xs rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background shadow-elevated animate-scale-in',
            SIDE[side],
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
