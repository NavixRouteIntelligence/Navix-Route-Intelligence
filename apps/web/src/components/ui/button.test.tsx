import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Button } from './button';

describe('Button', () => {
  it('dispara onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('fica desabilitado quando loading', () => {
    render(<Button loading>Salvar</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
