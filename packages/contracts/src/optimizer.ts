/**
 * Contratos do contexto Optimizer (Route Optimizer). MVP heurístico, sem ML.
 * Ver docs/reviews/phase-1-optimizer-plan.md e ADR-0022 (restrições ricas).
 */
import type { VehicleType } from './fleet';
import type { DeliveryPriority, DestinationType, TimeWindow } from './delivery';

export type OptimizationStrategyName = 'nearest-neighbor-2opt' | 'or-opt-2opt' | 'manual';

/** Modo Economia (ADR-0026): objetivo de otimização escolhido pelo usuário. */
export type EconomyMode = 'time' | 'fuel' | 'tolls' | 'co2';

export const ECONOMY_MODES: readonly EconomyMode[] = ['time', 'fuel', 'tolls', 'co2'];

export const OPTIMIZATION_STRATEGIES: readonly OptimizationStrategyName[] = [
  'nearest-neighbor-2opt',
  // Metaheurística mais forte (VND: Or-opt + 2-opt) — melhor qualidade, mesmo
  // contrato (ADR-0024). Um adaptador OR-Tools nativo entraria pela mesma port.
  'or-opt-2opt',
  // Ordem manual (identidade): preserva exatamente a sequência informada pelo
  // cliente — fundação do Routing Strategy Engine (ADR-0062). O motor computa
  // métricas/score/janelas para a ordem escolhida à mão, sem reordenar.
  'manual',
];

export interface OriginInput {
  latitude: number;
  longitude: number;
}

/** Parada informada inline (alternativa a `deliveryIds`). */
export interface OptimizationStopInput {
  id: string;
  latitude: number;
  longitude: number;
  priority?: DeliveryPriority;
  timeWindow?: TimeWindow | null;
  /** Demanda de carga da parada, em kg (ADR-0022). Default 0. */
  weightKg?: number;
  /** Demanda de volume da parada, em m³ (ADR-0022). Default 0. */
  volumeM3?: number;
  /** Tempo de parada/atendimento específico desta parada, em minutos (sobrepõe o global). */
  serviceTimeMinutes?: number;
  /**
   * Trava de posição (Routing Strategy Engine, ADR-0062/0063). Quando `true`, a
   * parada é **fixada na posição em que foi enviada** e a reotimização reordena
   * apenas as paradas livres ao redor — "ordem manual sem perder a reotimização".
   * Ignorada pela estratégia `manual` (que já preserva tudo).
   */
  locked?: boolean;
  /**
   * Tipo do destino (ADR-0064). Quando presente e sem `serviceTimeMinutes`
   * explícito, define o tempo de serviço por tipo (hospital demora mais que uma
   * casa). Se omitido, o motor pode inferir a partir do endereço (classificador).
   */
  destinationType?: DestinationType;
}

/**
 * Perfil do veículo da rota (ADR-0022). O `type` define capacidades e velocidade
 * padrão por tipo (moto/carro/carrinha/camião); os campos numéricos sobrepõem os
 * defaults. Tudo opcional — sem `vehicle`, o comportamento é o legado.
 */
export interface OptimizationVehicleInput {
  type?: VehicleType;
  /** Sobrepõe a capacidade de peso (kg) do tipo. */
  capacityKg?: number;
  /** Sobrepõe a capacidade de volume (m³) do tipo. */
  capacityVolumeM3?: number;
  /** Preferência por evitar pedágios (quando um provedor de pedágio existir — roadmap). */
  avoidTolls?: boolean;
}

export interface OptimizeRouteRequest {
  /**
   * Quando a rota **começa** (ISO-8601). Ausente: começa no instante do pedido
   * (ADR-0105). Informar é o que permite planejar hoje a rota de amanhã sem que
   * os ETAs saiam ancorados em hoje.
   */
  startAt?: string;
  /** Origem/depósito opcional; se ausente, a rota começa na primeira parada. */
  origin?: OriginInput | null;
  /** Fonte A: IDs de entregas existentes (buscadas no módulo Delivery). */
  deliveryIds?: string[];
  /** Fonte B: paradas inline. Use uma das duas fontes. */
  stops?: OptimizationStopInput[];
  strategy?: OptimizationStrategyName;
  averageSpeedKmh?: number;
  serviceTimeMinutes?: number;
  /** Modo Economia — o que priorizar (ADR-0026). Ausente = balanceado (legado). */
  economyMode?: EconomyMode;
  /**
   * Modo inteligente (ADR-0066): usa a estratégia mais forte e **deriva os pesos
   * do contexto** das paradas (janelas, urgência), combinando com histórico e
   * classificação. Quando true, tem precedência sobre `economyMode`; `strategy`
   * explícito ainda vence a escolha automática de algoritmo.
   */
  smart?: boolean;
  /** Perfil do veículo único (capacidade/velocidade por tipo). Opcional (ADR-0022). */
  vehicle?: OptimizationVehicleInput;
  /**
   * Frota para **roteirização multi-veículo** (ADR-0022, Fase 2). Quando presente,
   * as paradas são agrupadas por proximidade/capacidade e distribuídas entre os
   * veículos; a resposta traz `routes[]`. Mutuamente exclusivo com `vehicle`.
   */
  vehicles?: OptimizationVehicleInput[];
}

export interface RouteStopView {
  sequence: number;
  deliveryId: string;
  latitude: number;
  longitude: number;
  priority: DeliveryPriority;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  /**
   * Chegada à parada, em minutos desde a partida. **Não** inclui a espera nesta
   * parada: é quando o veículo encosta, e é o número que o motorista compara
   * com o relógio dele. A espera aparece em [waitMinutes] (ADR-0104).
   */
  etaMinutes: number;
  /**
   * Espera na porta até a janela abrir (ADR-0104). Presente e maior que zero
   * apenas quando se chega antes da abertura — o atendimento começa em
   * `etaMinutes + waitMinutes`, e é desse instante que as paradas seguintes
   * partem.
   */
  waitMinutes?: number;
  /**
   * A parada é atendida dentro da janela. `null` quando não há janela.
   *
   * Chegar antes **não** é desrespeito: o veículo espera, e a entrega acontece
   * dentro do combinado. `false` significa atraso de verdade — o atendimento
   * começa depois do fim da janela.
   */
  timeWindowRespected: boolean | null;
  /** Demanda de peso (kg) da parada. Presente quando informada (ADR-0022). */
  weightKg?: number;
  /** Demanda de volume (m³) da parada. Presente quando informada (ADR-0022). */
  volumeM3?: number;
  /** Parada travada nesta posição pela ordem manual (ADR-0063). Presente quando true. */
  locked?: boolean;
  /** Tipo do destino (ADR-0064). Presente quando informado ou classificado. */
  destinationType?: DestinationType;
}

/**
 * **Grupo Inteligente** (ADR-0075): as paradas de um mesmo tipo de destino,
 * agregadas. A IA não reordena a rota para juntar os grupos — ela otimiza a
 * sequência e o grupo é a *leitura* dessa sequência por categoria, para o
 * motorista saber o que vem pela frente ("4 comércios, depois 6 casas").
 *
 * `distanceKm` e `timeMinutes` **particionam exatamente** o total da rota: cada
 * parada atribui ao seu grupo a perna de chegada e o tempo até ela.
 */
export interface RouteGroupView {
  /** Tipo do destino. `other` agrega o que não foi classificado. */
  type: DestinationType;
  /** Ordem em que a rota encontra o grupo pela primeira vez (1..N). */
  order: number;
  /** Quantidade de paradas no grupo. */
  stops: number;
  /** Sequências das paradas (`RouteStopView.sequence`), em ordem de rota. */
  sequences: number[];
  /** Distância atribuível ao grupo (soma das pernas de chegada), km. */
  distanceKm: number;
  /** Tempo atribuível ao grupo (soma dos avanços de ETA), minutos. */
  timeMinutes: number;
}

export interface RouteMetrics {
  totalDistanceKm: number;
  /** Deslocamento + serviço + **espera** na porta (ADR-0104). */
  totalTimeMinutes: number;
  stops: number;
  /**
   * Minutos parado esperando janela abrir (ADR-0104). Já incluídos em
   * `totalTimeMinutes`; vêm separados porque espera não é trabalho, e uma rota
   * com muita espera é um problema de planeamento, não de produtividade.
   */
  totalWaitMinutes?: number;
  /**
   * Paradas cujo atendimento começa depois do fim da janela. `0` quando todas
   * cabem. Sinalização, nunca ajuste silencioso: a parada continua na rota.
   */
  lateStops?: number;
  /** Peso total transportado (kg). Presente quando há demanda informada (ADR-0022). */
  totalWeightKg?: number;
  /** Volume total transportado (m³). Presente quando há demanda informada (ADR-0022). */
  totalVolumeM3?: number;
  /** Emissão estimada de CO₂ (kg) da rota (ADR-0026). Presente quando há veículo. */
  estimatedCo2Kg?: number;
}

/** Análise de capacidade da rota vs. o veículo (ADR-0022). */
export interface CapacityUsage {
  /** true se a demanda total cabe no veículo em todas as dimensões. */
  feasible: boolean;
  weightKg: number;
  volumeM3: number;
  capacityKg: number | null;
  capacityVolumeM3: number | null;
  /** Excedente de peso (kg) quando inviável; 0 caso contrário. */
  overWeightKg: number;
  /** Excedente de volume (m³) quando inviável; 0 caso contrário. */
  overVolumeM3: number;
}

export interface RouteSavings {
  distanceKm: number;
  timeMinutes: number;
  distancePct: number;
  timePct: number;
}

export interface RoutePlanParams {
  averageSpeedKmh: number;
  serviceTimeMinutes: number;
  hasOrigin: boolean;
  /** Tipo de veículo considerado (ADR-0022). Presente quando informado. */
  vehicleType?: VehicleType;
  /** Preferência de evitar pedágios (ADR-0022). Presente quando informada. */
  avoidTolls?: boolean;
  /** Nº de veículos com rota atribuída (ADR-0022, Fase 2). Presente no multi-veículo. */
  vehicleCount?: number;
  /** Nº de paradas não atribuídas por falta de capacidade (ADR-0022, Fase 2). */
  unassignedCount?: number;
  /** Modo Economia aplicado (ADR-0026). Presente quando informado. */
  economyMode?: EconomyMode;
  /** Modo inteligente aplicado (ADR-0066). Presente quando ativo. */
  smart?: boolean;
}

/** Rota de um veículo dentro de um plano multi-veículo (ADR-0022, Fase 2). */
export interface VehicleRouteView {
  /** Índice do veículo na frota informada (0-based). */
  vehicleIndex: number;
  vehicleType?: VehicleType;
  stops: RouteStopView[];
  metrics: RouteMetrics;
  capacity?: CapacityUsage;
}

export interface RoutePlan {
  id: string;
  tenantId: string;
  /**
   * **Ficha** do motorista dono da rota (ADR-0098). `null` no plano de frota do
   * despacho, que cobre vários veículos, e no motorista autônomo, que não tem
   * ficha. Planos criados antes do vínculo existir também vêm nulos.
   */
  driverId: string | null;
  /**
   * Dia operacional do plano (`YYYY-MM-DD`) — o eixo da rota vigente. Derivado
   * no **fuso do tenant** (ADR-0105).
   */
  operationalDay: string;
  /**
   * Horário-base do cálculo (ISO-8601): o instante do minuto zero, de onde
   * todo `etaMinutes` parte (ADR-0105). A chegada real de uma parada é
   * `departureAt + etaMinutes` — e é este campo que torna essa conta
   * verificável por quem consome, em vez de depender de `createdAt`.
   */
  departureAt: string;
  strategy: OptimizationStrategyName;
  status: 'completed';
  params: RoutePlanParams;
  /** Paradas na ordem final. Em plano multi-veículo, é a concatenação de `routes`. */
  stops: RouteStopView[];
  /**
   * Grupos Inteligentes derivados de [stops] (ADR-0075). Computado na leitura —
   * não é persistido, então planos antigos também ganham os grupos.
   */
  groups: RouteGroupView[];
  /** Métricas agregadas (soma entre veículos, no caso multi-veículo). */
  metrics: RouteMetrics;
  baseline: RouteMetrics;
  savings: RouteSavings;
  /** Score da rota, 0–100. */
  score: number;
  explanation: string;
  /** Uso de capacidade vs. o veículo (ADR-0022). Presente quando há veículo/demanda. */
  capacity?: CapacityUsage;
  /** Rotas por veículo (ADR-0022, Fase 2). Presente quando `vehicles` foi informado. */
  routes?: VehicleRouteView[];
  /** IDs de paradas que não couberam em nenhum veículo (frota insuficiente). */
  unassignedStops?: string[];
  createdAt: string;
}

// ===========================================================================
// Otimização assíncrona por Jobs (ADR-0007). O POST enfileira e responde 202;
// o cliente acompanha por polling (GET .../jobs/:jobId) — e, futuramente, por
// WebSocket. Ver docs/api.md §5.1.
// ===========================================================================

export type OptimizationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** Recurso de job de otimização. */
export interface OptimizationJob {
  jobId: string;
  status: OptimizationJobStatus;
  /** ID do Route Plan resultante — preenchido quando `succeeded`. */
  routePlanId: string | null;
  /** Mensagem de erro — preenchida quando `failed`. */
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resposta `202 Accepted` do enfileiramento da otimização. */
export interface OptimizationJobAccepted {
  jobId: string;
  status: OptimizationJobStatus;
}

/** O que coube a uma ficha na distribuição (ADR-0101). */
export interface DriverDistributionShare {
  /** Ficha do motorista (`drivers.id`), nunca o login — ADR-0086. */
  driverId: string;
  /** Entregas atribuídas a esta ficha **nesta** distribuição. */
  deliveries: number;
  /**
   * Job da rota preparada para ela, ou `null` quando não havia o que otimizar
   * (uma parada só não forma rota). `null` aqui não é falha.
   */
  jobId: string | null;
}

/** Resultado de `POST /route-plans/distribute` (ADR-0101). */
export interface DeliveryDistribution {
  /** Entregas que ganharam motorista agora. */
  assigned: number;
  /**
   * Entregas sem motorista que continuaram sem. Hoje só acontece quando o
   * tenant não tem ficha ativa nenhuma — sem ninguém para receber, nada é
   * atribuído e nada se perde.
   */
  unassigned: number;
  /** Uma entrada por ficha que recebeu ao menos uma entrega. */
  shares: DriverDistributionShare[];
}

/** Como está o dia de um motorista da frota (ADR-0101). */
export interface DriverWorkload {
  /** Ficha (`drivers.id`). */
  driverId: string;
  driverName: string;
  /** Entregas atribuídas a ele que ainda não saíram. */
  pending: number;
  /** Entregas atribuídas a ele já em rota. */
  inRoute: number;
  /**
   * Rota vigente do dia operacional, quando existe. `null` é estado normal:
   * motorista sem entrega, ou com menos de duas (não há sequência a montar).
   */
  routePlanId: string | null;
  stops: number | null;
  distanceKm: number | null;
}

/**
 * Retrato da distribuição atual da frota (ADR-0101) — quem está com o quê,
 * agora. É a leitura que responde "a distribuição funcionou?" e "sobrou
 * alguém sem trabalho?".
 */
export interface FleetDistribution {
  /** Uma linha por ficha **ativa**, inclusive quem está sem nada. */
  drivers: DriverWorkload[];
  /** Entregas ativas ainda sem motorista — o que uma distribuição repartiria. */
  unassigned: number;
}
