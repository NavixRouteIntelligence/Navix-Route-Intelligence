'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  DELIVERY_PRIORITIES,
  type CreateDeliveryRequest,
  type Delivery,
} from '@navix/contracts';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { fleetApi } from '@/lib/api/fleet';

const schema = z.object({
  street: z.string().min(1, 'Obrigatório.'),
  number: z.string().min(1, 'Obrigatório.'),
  complement: z.string().optional(),
  city: z.string().min(1, 'Obrigatório.'),
  state: z.string().min(1, 'Obrigatório.'),
  postalCode: z.string().min(1, 'Obrigatório.'),
  country: z.string().min(2).max(60),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  priority: z.enum(DELIVERY_PRIORITIES as unknown as [string, ...string[]]),
  windowStart: z.string().min(1, 'Obrigatório.'),
  windowEnd: z.string().min(1, 'Obrigatório.'),
  notes: z.string().optional(),
  driverId: z.string().optional(),
  vehicleId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

export function DeliveryForm({
  delivery,
  submitting,
  submitLabel,
  onSubmit,
}: {
  delivery?: Delivery;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (body: CreateDeliveryRequest) => void;
}) {
  const vehicles = useQuery({ queryKey: ['vehicles', 'options'], queryFn: () => fleetApi.listVehicles({ pageSize: 100 }) });
  const drivers = useQuery({ queryKey: ['drivers', 'options'], queryFn: () => fleetApi.listDrivers({ pageSize: 100 }) });

  const now = new Date();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      street: delivery?.address.street ?? '',
      number: delivery?.address.number ?? '',
      complement: delivery?.address.complement ?? '',
      city: delivery?.address.city ?? '',
      state: delivery?.address.state ?? '',
      postalCode: delivery?.address.postalCode ?? '',
      country: delivery?.address.country ?? 'BR',
      latitude: delivery?.address.latitude ?? (undefined as unknown as number),
      longitude: delivery?.address.longitude ?? (undefined as unknown as number),
      priority: delivery?.priority ?? 'normal',
      windowStart: delivery ? isoToLocalInput(delivery.timeWindow.start) : isoToLocalInput(now.toISOString()),
      windowEnd: delivery
        ? isoToLocalInput(delivery.timeWindow.end)
        : isoToLocalInput(new Date(now.getTime() + 3 * 3600_000).toISOString()),
      notes: delivery?.notes ?? '',
      driverId: delivery?.driverId ?? '',
      vehicleId: delivery?.vehicleId ?? '',
    },
  });

  function submit(values: FormValues) {
    onSubmit({
      address: {
        street: values.street,
        number: values.number,
        complement: values.complement || null,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
        country: values.country,
        latitude: values.latitude,
        longitude: values.longitude,
      },
      priority: values.priority as CreateDeliveryRequest['priority'],
      timeWindow: {
        start: new Date(values.windowStart).toISOString(),
        end: new Date(values.windowEnd).toISOString(),
      },
      notes: values.notes || null,
      driverId: values.driverId || null,
      vehicleId: values.vehicleId || null,
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-6">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <Field label="Rua" error={errors.street?.message} required className="sm:col-span-2">
            {(id) => <Input id={id} {...register('street')} />}
          </Field>
          <Field label="Número" error={errors.number?.message} required>
            {(id) => <Input id={id} {...register('number')} />}
          </Field>
          <Field label="Complemento">
            {(id) => <Input id={id} {...register('complement')} />}
          </Field>
          <Field label="Cidade" error={errors.city?.message} required>
            {(id) => <Input id={id} {...register('city')} />}
          </Field>
          <Field label="Estado" error={errors.state?.message} required>
            {(id) => <Input id={id} {...register('state')} />}
          </Field>
          <Field label="CEP" error={errors.postalCode?.message} required>
            {(id) => <Input id={id} {...register('postalCode')} />}
          </Field>
          <Field label="País" error={errors.country?.message}>
            {(id) => <Input id={id} {...register('country')} />}
          </Field>
          <Field label="Latitude" error={errors.latitude?.message} required>
            {(id) => <Input id={id} type="number" step="any" {...register('latitude')} placeholder="-23.561" />}
          </Field>
          <Field label="Longitude" error={errors.longitude?.message} required>
            {(id) => <Input id={id} type="number" step="any" {...register('longitude')} placeholder="-46.656" />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <Field label="Prioridade">
            {(id) => (
              <Select id={id} {...register('priority')}>
                {DELIVERY_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <div />
          <Field label="Janela — início" error={errors.windowStart?.message} required>
            {(id) => <Input id={id} type="datetime-local" {...register('windowStart')} />}
          </Field>
          <Field label="Janela — fim" error={errors.windowEnd?.message} required>
            {(id) => <Input id={id} type="datetime-local" {...register('windowEnd')} />}
          </Field>
          <Field label="Veículo (opcional)">
            {(id) => (
              <Select id={id} {...register('vehicleId')}>
                <option value="">— nenhum —</option>
                {(vehicles.data?.data ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Motorista (opcional)">
            {(id) => (
              <Select id={id} {...register('driverId')}>
                <option value="">— nenhum —</option>
                {(drivers.data?.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            {(id) => <Textarea id={id} {...register('notes')} placeholder="Notas da entrega…" />}
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
