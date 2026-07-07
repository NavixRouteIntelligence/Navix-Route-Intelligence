import { cn } from '@/lib/utils';

/** Placeholder de carregamento com shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[shimmer_1.5s_infinite]',
        'before:bg-gradient-to-r before:from-transparent before:via-foreground/5 before:to-transparent',
        className,
      )}
    />
  );
}
