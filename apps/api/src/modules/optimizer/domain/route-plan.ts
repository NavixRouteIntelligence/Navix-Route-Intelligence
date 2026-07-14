import type {
  CapacityUsage,
  OptimizationStrategyName,
  RouteMetrics,
  RoutePlanParams,
  RouteSavings,
  RouteStopView,
} from '@navix/contracts';

import { newId } from '../../../shared/kernel/id';

export interface RoutePlanProps {
  id: string;
  tenantId: string;
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
  createdAt: Date;
}

export type NewRoutePlan = Omit<RoutePlanProps, 'id' | 'createdAt'>;

/**
 * Resultado de uma otimização, persistido para histórico, auditoria e futura
 * reotimização. Imutável após criado (snapshot no tempo da otimização).
 */
export class RoutePlan {
  private constructor(private readonly props: RoutePlanProps) {}

  static create(data: NewRoutePlan): RoutePlan {
    return new RoutePlan({ ...data, id: newId(), createdAt: new Date() });
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
}
