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

export type NewRoutePlan = Omit<RoutePlanProps, 'id' | 'createdAt' | 'operationalDay'>;

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
      operationalDay: operationalDayOf(createdAt),
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
}
