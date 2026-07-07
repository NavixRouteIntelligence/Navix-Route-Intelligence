'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string }
>(({ className, children, title, description, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm data-[state=open]:animate-fade-in" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4',
        'rounded-xl border border-border bg-card p-6 shadow-elevated data-[state=open]:animate-fade-in',
        className,
      )}
      {...props}
    >
      <div className="grid gap-1">
        <DialogPrimitive.Title className="text-h3">{title}</DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="text-sm text-muted-foreground">
            {description}
          </DialogPrimitive.Description>
        )}
      </div>
      {children}
      <DialogPrimitive.Close
        aria-label="Fechar"
        className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = 'DialogContent';

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="flex justify-end gap-2 pt-2">{children}</div>;
}
