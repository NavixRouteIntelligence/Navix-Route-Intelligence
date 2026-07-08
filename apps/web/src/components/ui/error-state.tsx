import { AlertTriangle, RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Estado de erro reutilizável (com retry opcional). */
export function ErrorState({
  title = 'Algo deu errado',
  description = 'Não foi possível carregar. Tente novamente.',
  onRetry,
  retryLabel = 'Tentar novamente',
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-lg border border-dashed border-danger/40 bg-danger/5 px-6 py-14 text-center"
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="text-h3">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RotateCcw className="h-4 w-4" />
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
