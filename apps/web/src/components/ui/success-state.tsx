import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';

/** Estado de sucesso reutilizável (ex.: fim de fluxo). */
export function SuccessState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-success/40 bg-success/5 px-6 py-14 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success animate-scale-in">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-h3">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
