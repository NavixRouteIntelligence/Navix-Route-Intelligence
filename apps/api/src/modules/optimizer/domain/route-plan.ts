import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RoutePlanParams,
  RouteSavings,
  RouteStopView,
  VehicleRouteView,
} from '@navix/contracts';

import { newId } from '../../../shared/kernel/id';

export interface RoutePlanProps {
  id: string;
  tenantId: string;
  /**
   * **Ficha** do motorista dono da rota (ADR-0086/0098). Nula em dois casos
   * legítimos: o motorista autônomo, que não tem ficha, e o plano de frota do
   * despacho, que cobre vários veículos e não pertence a uma pessoa só.
   */
  driverId: string | null;
  /**
   * Dia operacional a que o plano pertence (`YYYY-MM-DD`).
   *
   * É o eixo por onde a rota vigente é encontrada. Derivado de `createdAt` na
   * criação — e a mesma derivação é usada na leitura, o que importa mais do que
   * qual fuso se escolhe: escrita e leitura têm de concordar.
   */
  operationalDay: string;
  /**
   * Instante em que a otimização foi **pedida** — não em que terminou.
   *
   * É por ele que se decide quem substitui quem: comparar conclusões deixaria
   * um job lento, pedido antes, sobrescrever a ordem manual pedida depois
   * (ADR-0103).
   */
  requestedAt: Date;
  /**
   * O plano é a rota **de um motorista** naquele dia — uma coisa só, que o
   * pedido mais recente substitui. `false` no plano do despacho, que roteiriza
   * recortes diferentes da frota e legitimamente tem vários por dia.
   */
  driverScoped: boolean;
  strategy: OptimizationStrategyName;
  status: 'completed';
  params: RoutePlanParams;
  stops: RouteStopView[];
  metrics: RouteMetrics;
  baseline: RouteMetrics;
  savings: RouteSavings;
  score: number;
  explanation: string;
  /** Uso de capacidade vs. veículo (ADR-0022). Ausente sem veículo/demanda. */
  capacity?: CapacityUsage;
  /** Rotas por veículo (ADR-0022, Fase 2). Ausente no plano de veículo único. */
  routes?: VehicleRouteView[];
  /** Paradas não atribuídas por falta de capacidade (ADR-0022, Fase 2). */
  unassignedStops?: string[];
  createdAt: Date;
}

/**
 * `requestedAt` é opcional: no caminho síncrono pedido e conclusão são o mesmo
 * instante. Já `driverScoped` é obrigatório de propósito — um default silencioso
 * ou desligaria a proteção da ordem manual, ou descartaria plano do despacho.
 */
export type NewRoutePlan = Omit<
  RoutePlanProps,
  'id' | 'createdAt' | 'operationalDay' | 'requestedAt'
> & { requestedAt?: Date };

/** Dia operacional de um instante (`YYYY-MM-DD`). Ver a nota em `operationalDay`. */
export function operationalDayOf(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * Resultado de uma otimização, persistido para histórico, auditoria e futura
 * reotimização. Imutável após criado (snapshot no tempo da otimização).
 */
export class RoutePlan {
  private constructor(private readonly props: RoutePlanProps) {}

  static create(data: NewRoutePlan): RoutePlan {
    const createdAt = new Date();
    return new RoutePlan({
      ...data,
      id: newId(),
      createdAt,
      requestedAt: data.requestedAt ?? createdAt,
      // O dia é o do **pedido**: um job pedido às 23h55 e concluído às 00h05
      // pertence ao dia em que o motorista o pediu, não ao seguinte.
      operationalDay: operationalDayOf(data.requestedAt ?? createdAt),
    });
  }

  static restore(props: RoutePlanProps): RoutePlan {
    return new RoutePlan(props);
  }

  snapshot(): Readonly<RoutePlanProps> {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  get driverId(): string | null {
    return this.props.driverId;
  }

  get requestedAt(): Date {
    return this.props.requestedAt;
  }
}
