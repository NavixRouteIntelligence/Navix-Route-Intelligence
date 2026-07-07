import { cn } from '@/lib/utils';

/** Glifo da marca Navix: um caminho (rota) com um pin de destino. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn('h-8 w-8', className)}
      role="img"
      aria-label="Navix"
    >
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <path
        d="M8 22c4 0 4-8 8-8s4 6 8 6"
        stroke="hsl(var(--primary-foreground))"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeDasharray="0.1 4.2"
      />
      <circle cx="8" cy="22" r="2.4" fill="hsl(var(--accent))" />
      <path
        d="M24 8.5c-1.9 0-3.4 1.5-3.4 3.4 0 2.4 3.4 5.1 3.4 5.1s3.4-2.7 3.4-5.1c0-1.9-1.5-3.4-3.4-3.4Z"
        fill="hsl(var(--primary-foreground))"
      />
      <circle cx="24" cy="11.8" r="1.25" fill="hsl(var(--primary))" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      {showWordmark && <span className="text-h3 font-semibold tracking-tight">Navix</span>}
    </span>
  );
}
