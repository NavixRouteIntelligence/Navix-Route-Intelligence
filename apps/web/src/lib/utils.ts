import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Combina classes Tailwind resolvendo conflitos. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Formata número com separador de milhar (pt-BR). */
export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/** Formata data ISO para exibição curta (pt-BR). */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
