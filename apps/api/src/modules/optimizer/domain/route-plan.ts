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
   * Instante do **minuto zero** da rota (ADR-0105): quando o veículo parte.
   *
   * É a âncora de todo ETA. Antes havia duas, e elas discordavam — o solver
   * media os minutos a partir da abertura de janela mais cedo, e quem consumia
   * ETA os somava ao `createdAt` do plano. Com janelas abrindo três horas
   * depois do planeamento, o rastreio anunciava a entrega para *agora*.
   */
  departureAt: Date;
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
  'id' | 'createdAt' | 'operationalDay' | 'requestedAt' | 'departureAt'
> & { requestedAt?: Date; departureAt?: Date; timeZone?: string };

/**
 * Dia operacional de um instante (`YYYY-MM-DD`) **no fuso de quem opera**
 * (ADR-0105).
 *
 * Em UTC — o padrão — o resultado é idêntico ao anterior. Com fuso configurado,
 * uma rota criada às 21h em São Paulo continua sendo de hoje para o motorista,
 * em vez de cair no dia seguinte e sumir da tela dele.
 *
 * A invariante da ADR-0098 continua valendo e agora tem uma exigência a mais:
 * escrita e leitura têm de derivar o dia com esta função **e com o mesmo fuso**.
 * Se divergirem, a rota some da tela sem erro nenhum.
 */
export function operationalDayOf(at: Date, timeZone = 'UTC'): string {
  // `en-CA` produz `YYYY-MM-DD`, que é exatamente o formato de `date` no
  // Postgres — evita montar a string a partir de partes e errar o zero à
  // esquerda.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/**
 * Resultado de uma otimização, persistido para histórico, auditoria e futura
 * reotimização. Imutável após criado (snapshot no tempo da otimização).
 */
export class RoutePlan {
  private constructor(private readonly props: RoutePlanProps) {}

  static create(data: NewRoutePlan): RoutePlan {
    const createdAt = new Date();
    // `timeZone` orienta a derivação do dia, mas não é propriedade do plano: o
    // que fica gravado é o dia já resolvido.
    const { timeZone, departureAt, ...props } = data;
    const requestedAt = data.requestedAt ?? createdAt;
    return new RoutePlan({
      ...props,
      id: newId(),
      createdAt,
      requestedAt,
      // Sem partida explícita, a rota começa quando foi pedida — que para o
      // motorista tocando "reorganizar" é agora, e para uma reotimização é o
      // instante do gatilho.
      departureAt: departureAt ?? requestedAt,
      // O dia é o do **pedido**: um job pedido às 23h55 e concluído às 00h05
      // pertence ao dia em que o motorista o pediu, não ao seguinte.
      operationalDay: operationalDayOf(requestedAt, timeZone),
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

  get departureAt(): Date {
    return this.props.departureAt;
  }
}
