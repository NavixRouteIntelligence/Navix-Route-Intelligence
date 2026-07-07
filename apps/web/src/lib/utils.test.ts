import { describe, expect, it } from 'vitest';

import { cn, formatNumber } from './utils';

describe('utils', () => {
  it('cn resolve conflitos do Tailwind (mantém a última classe)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm', false && 'hidden', 'font-bold')).toBe('text-sm font-bold');
  });

  it('formatNumber usa separador pt-BR', () => {
    expect(formatNumber(1234)).toBe('1.234');
    expect(formatNumber(3318.9, 1)).toBe('3.318,9');
  });
});
