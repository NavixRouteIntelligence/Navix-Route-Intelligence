import { useId, type ReactNode } from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Recebe o id para vincular ao controle (aria). */
  children: (id: string) => ReactNode;
}

/** Agrupa rótulo + controle + erro/dica com acessibilidade (aria-describedby). */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn('grid gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </Label>
      {children(id)}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
