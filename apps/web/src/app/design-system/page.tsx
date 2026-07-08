'use client';

import { Rocket, Truck } from 'lucide-react';
import { useState } from 'react';

import { ThemeToggle } from '@/components/layout/theme-toggle';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Logo } from '@/components/ui/logo';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { StatCard } from '@/components/ui/stat-card';
import {
  DeliveryStatusBadge,
  DriverStatusBadge,
  PriorityBadge,
  VehicleStatusBadge,
} from '@/components/ui/status-badge';
import { TABLE_DEMO } from '@/components/ui/_demo';
import { TD, TH, THead, TR, Table } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/toast';

const SWATCHES = [
  ['Primary', 'bg-primary'],
  ['Accent', 'bg-accent'],
  ['Success', 'bg-success'],
  ['Warning', 'bg-warning'],
  ['Danger', 'bg-danger'],
  ['Muted', 'bg-muted'],
  ['Chart 1', 'bg-chart-1'],
  ['Chart 2', 'bg-chart-2'],
  ['Chart 3', 'bg-chart-3'],
  ['Chart 4', 'bg-chart-4'],
  ['Chart 5', 'bg-chart-5'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-h2">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-12 px-6 py-12">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Logo />
          <p className="text-sm text-muted-foreground">Design System — identidade, componentes e estados.</p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Cores">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {SWATCHES.map(([name, bg]) => (
            <div key={name} className="space-y-1.5">
              <div className={`h-14 rounded-lg border border-border ${bg}`} />
              <p className="text-xs text-muted-foreground">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografia">
        <div className="space-y-2">
          <p className="text-display">Display · Navix</p>
          <p className="text-h1">Heading 1</p>
          <p className="text-h2">Heading 2</p>
          <p className="text-h3">Heading 3</p>
          <p className="text-base">Corpo — texto padrão da interface.</p>
          <p className="text-sm text-muted-foreground">Small · texto auxiliar.</p>
          <p className="font-mono text-sm">mono · 019f3364-50d8-7665</p>
        </div>
      </Section>

      <Section title="Botões">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Carregando</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges e status">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="primary">Primary</Badge>
          <Badge tone="success">Success</Badge>
          <Badge tone="warning">Warning</Badge>
          <Badge tone="danger">Danger</Badge>
          <DeliveryStatusBadge status="in_route" />
          <DeliveryStatusBadge status="delivered" />
          <PriorityBadge priority="urgent" />
          <VehicleStatusBadge status="maintenance" />
          <DriverStatusBadge status="active" />
        </div>
      </Section>

      <Section title="Alertas (estados)">
        <div className="grid gap-3">
          <Alert tone="info" title="Informação">Detalhe informativo para o usuário.</Alert>
          <Alert tone="success" title="Sucesso">Operação concluída com êxito.</Alert>
          <Alert tone="warning" title="Atenção">Verifique os dados antes de continuar.</Alert>
          <Alert tone="error" title="Erro">Não foi possível concluir a ação.</Alert>
        </div>
      </Section>

      <Section title="Formulário">
        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
            <Field label="E-mail" hint="Usado para acesso" required>
              {(id) => <Input id={id} placeholder="voce@empresa.com" />}
            </Field>
            <Field label="Prioridade">
              {(id) => (
                <Select id={id} defaultValue="normal">
                  <option value="low">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </Select>
              )}
            </Field>
            <Field label="Observações" className="sm:col-span-2" error="Campo obrigatório.">
              {(id) => <Textarea id={id} placeholder="Notas da entrega…" />}
            </Field>
          </CardContent>
        </Card>
      </Section>

      <Section title="Feedback e carregamento">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => toast({ tone: 'success', title: 'Salvo!', description: 'Registro criado.' })}>
            Toast de sucesso
          </Button>
          <Button variant="outline" onClick={() => toast({ tone: 'error', title: 'Falhou', description: 'Tente novamente.' })}>
            Toast de erro
          </Button>
          <Spinner />
          <Skeleton className="h-10 w-40" />
        </div>
      </Section>

      <Section title="Cartões de métrica">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Entregas" value={128} icon={Truck} tone="primary" hint="+12% na semana" />
          <StatCard label="Otimizações" value={34} icon={Rocket} tone="accent" />
          <StatCard label="Carregando" value={0} icon={Truck} tone="success" loading />
        </div>
      </Section>

      <Section title="Tabela">
        <Table>
          <THead>
            <TR>
              <TH>Placa</TH>
              <TH>Tipo</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <tbody>
            {TABLE_DEMO.map((r) => (
              <TR key={r.plate}>
                <TD className="font-medium">{r.plate}</TD>
                <TD className="text-muted-foreground">{r.type}</TD>
                <TD>
                  <VehicleStatusBadge status={r.status} />
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Section>

      <Section title="Overlays e estado vazio">
        <div className="grid gap-4 md:grid-cols-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Abrir diálogo</Button>
            </DialogTrigger>
            <DialogContent title="Confirmar ação" description="Esta é uma janela modal acessível.">
              <p className="text-sm text-muted-foreground">Conteúdo do diálogo.</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setOpen(false)}>Confirmar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <EmptyState icon={Truck} title="Nenhum veículo" description="Cadastre o primeiro veículo da frota." />
        </div>
      </Section>
    </div>
  );
}
