'use client';

import type { PodStatus } from '@navix/contracts';
import { useMutation } from '@tanstack/react-query';
import { Camera, CheckCircle2, MapPin, UserX, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { SignaturePad } from '@/components/pod/signature-pad';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';
import { podApi } from '@/lib/api/pod';
import { trackingApi } from '@/lib/api/tracking';
import { fileToDownscaledDataUrl } from '@/lib/pod/image';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS: { value: PodStatus; label: string; icon: typeof CheckCircle2 }[] = [
  { value: 'delivered', label: 'Entregue', icon: CheckCircle2 },
  { value: 'absent', label: 'Ausente', icon: UserX },
  { value: 'refused', label: 'Recusado', icon: XCircle },
];

export function PodCapture({
  open,
  onOpenChange,
  deliveryId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deliveryId: string | null;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<PodStatus>('delivered');
  const [photo, setPhoto] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsState, setGpsState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  // Reseta e captura GPS ao abrir.
  useEffect(() => {
    if (!open) return;
    setStatus('delivered');
    setPhoto(null);
    setSignature(null);
    setNote('');
    setCoords(null);
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setGpsState('loading');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setCoords({ lat: p.coords.latitude, lng: p.coords.longitude });
          setGpsState('done');
        },
        () => setGpsState('error'),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, [open]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!deliveryId) throw new Error('Entrega inválida.');
      const view = await podApi.submit({
        deliveryId,
        status,
        note: note.trim() || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
        photo,
        signature,
      });
      // Integração com Tracking: registra a posição do desfecho.
      if (coords) {
        await trackingApi
          .update({ latitude: coords.lat, longitude: coords.lng, status: 'finished' })
          .catch(() => undefined);
      }
      return view;
    },
    onSuccess: () => {
      toast({ tone: 'success', title: 'Comprovante registrado' });
      onOpenChange(false);
      onDone?.();
    },
    onError: (e: Error) => toast({ tone: 'error', title: 'Falha ao registrar', description: e.message }),
  });

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhoto(await fileToDownscaledDataUrl(file));
    } catch {
      toast({ tone: 'error', title: 'Não foi possível processar a foto' });
    }
  }

  const needsProof = status === 'delivered';
  const canSubmit = deliveryId && (!needsProof || photo || signature) && !submit.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Comprovante de entrega" description="Registre o desfecho da entrega." className="max-w-xl">
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          {/* Status */}
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Status">
            {STATUS_OPTIONS.map((o) => {
              const Icon = o.icon;
              const active = status === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setStatus(o.value)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-3 text-sm transition-colors',
                    active ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50',
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                  {o.label}
                </button>
              );
            })}
          </div>

          {/* GPS */}
          <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <MapPin className="h-4 w-4 text-primary" aria-hidden />
            {gpsState === 'loading' && <span className="text-muted-foreground">Capturando localização…</span>}
            {gpsState === 'done' && coords && (
              <span className="font-mono">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</span>
            )}
            {gpsState === 'error' && <span className="text-warning">Localização indisponível</span>}
            {gpsState === 'idle' && <span className="text-muted-foreground">—</span>}
          </div>

          {/* Foto */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto {needsProof && <span className="text-muted-foreground">(foto ou assinatura)</span>}</p>
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Foto do comprovante" className="max-h-48 w-full rounded-lg border border-border object-contain" />
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setPhoto(null)}>
                  Remover foto
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Camera className="h-4 w-4" />
                Tirar/enviar foto
              </Button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={onPickPhoto} />
          </div>

          {/* Assinatura */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Assinatura</p>
            <SignaturePad onChange={setSignature} />
          </div>

          {/* Observação */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Observação</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: entregue ao porteiro" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submit.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => submit.mutate()} disabled={!canSubmit}>
            {submit.isPending ? <Spinner className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
