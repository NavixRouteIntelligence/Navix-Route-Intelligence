'use client';

import { FileSpreadsheet, FileText, UploadCloud } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const ACCEPT = '.csv,.xls,.xlsx,.pdf';
const ACCEPT_EXT = ['csv', 'xls', 'xlsx', 'pdf'];
const MAX_BYTES = 5 * 1024 * 1024;

function isSupported(file: File): boolean {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  return ACCEPT_EXT.includes(ext);
}

/** Área de upload por clique ou arrastar-e-soltar. Valida tipo e tamanho. */
export function ImportDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!isSupported(file)) {
        setError('Formato não suportado. Use CSV, XLS/XLSX ou PDF.');
        return;
      }
      if (file.size > MAX_BYTES) {
        setError('Arquivo acima de 5 MB.');
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          disabled
            ? 'cursor-not-allowed border-border opacity-60'
            : 'cursor-pointer hover:border-primary/60 hover:bg-muted/40',
          dragging ? 'border-primary bg-primary/5' : 'border-border',
        )}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-medium">
            Arraste um arquivo ou <span className="text-primary">clique para selecionar</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV, Excel (XLS/XLSX) ou PDF · até 5 MB
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileSpreadsheet className="h-4 w-4" aria-hidden /> Planilhas
          </span>
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4" aria-hidden /> PDF (best-effort)
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handle(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
