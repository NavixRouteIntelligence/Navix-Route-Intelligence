'use client';

import { AlertCircle, CheckCircle2, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'info' | 'success' | 'warning' | 'error';
interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

const ICONS: Record<Tone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};
const ICON_TONE: Record<Tone, string> = {
  info: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

interface ToastContextValue {
  toast: (t: { tone?: Tone; title: string; description?: string }) => void;
}
const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue['toast']>(
    ({ tone = 'info', title, description }) => {
      const id = ++counter;
      setToasts((prev) => [...prev, { id, tone, title, description }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
        aria-live="polite"
        role="region"
      >
        {toasts.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-lg border border-border bg-card p-3.5 shadow-elevated"
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', ICON_TONE[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Fechar"
                className="rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return ctx;
}
