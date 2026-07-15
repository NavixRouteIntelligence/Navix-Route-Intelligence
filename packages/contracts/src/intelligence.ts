/**
 * Contratos da Navix Intelligence — a camada de IA/predição (ADR-0025).
 *
 * Primeira camada: heurísticas desacopladas atrás de *ports*, prontas para
 * evoluir para modelos de ML/LLM sem alterar estes contratos.
 */
import type { VehicleType } from './fleet';
import type { TimeWindow } from './delivery';

export interface ForecastStopInput {
  id: string;
  latitude: number;
  longitude: number;
  /** Janela de entrega (SLA). Opcional. */
  timeWindow?: TimeWindow | null;
  /** Tempo de atendimento específico da parada (min). */
  serviceTimeMinutes?: number;
  /** Observações de acesso ao destino (ex.: `delivery.notes`). Origem das instruções. */
  accessNotes?: string;
}

/** Tipo de instrução de acesso ao destino (navegação contextual — ADR-0028). */
export type AccessInstructionKind =
  | 'entrance'
  | 'dock'
  | 'intercom'
  | 'gate_code'
  | 'reception'
  | 'note';

export interface AccessInstructionView {
  kind: AccessInstructionKind;
  text: string;
}

/** Perfil do motorista aprendido/override (IA personalizada). */
export interface DriverProfileInput {
  /** Multiplicador da velocidade base (1 = neutro; >1 mais rápido). */
  speedFactor?: number;
  /** Tempo médio de atendimento por parada (min). */
  serviceTimeMinutes?: number;
  /** Pontualidade histórica, 0..1. */
  punctuality?: number;
}

export interface RouteForecastRequest {
  /** Paradas na ordem pretendida de visita. */
  stops: ForecastStopInput[];
  vehicleType?: VehicleType;
  origin?: { latitude: number; longitude: number } | null;
  /** Partida mais cedo permitida (ISO 8601). Default: agora. */
  earliestDeparture?: string;
  averageSpeedKmh?: number;
  driverId?: string;
  /** Override explícito do perfil do motorista. */
  driver?: DriverProfileInput;
  /** Nível atual de combustível/carga, 0..100. */
  currentFuelPercent?: number;
}

export interface ScheduledStopView {
  id: string;
  sequence: number;
  /** Minutos desde a partida até a chegada. */
  etaMinutes: number;
  arrivalAt: string;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  serviceMinutes: number;
  /** null quando a parada não tem janela. */
  timeWindowRespected: boolean | null;
  /** Instruções de acesso ao destino (ADR-0028). Presente quando há observações. */
  access?: AccessInstructionView[];
}

export interface RouteScheduleView {
  departureAt: string;
  completionAt: string;
  totalMinutes: number;
  totalDistanceKm: number;
  stops: ScheduledStopView[];
}

export type DelaySeverity = 'low' | 'medium' | 'high';

export interface DelayRiskView {
  stopId: string;
  minutesLate: number;
  severity: DelaySeverity;
  reason: string;
  mitigation: string;
}

export type FuelUnit = 'L' | 'kWh';

export interface FuelAdviceView {
  vehicleType: VehicleType;
  estimatedConsumption: number;
  unit: FuelUnit;
  /** Autonomia estimada com o nível atual (km); null se nível não informado. */
  estimatedRangeKm: number | null;
  refuelRecommended: boolean;
  reason: string;
}

export interface DepartureRecommendationView {
  recommendedDepartureAt: string;
  expectedLateStops: number;
  rationale: string;
}

export type TrafficWindow = 'off_peak' | 'moderate' | 'peak';

export interface TrafficContextView {
  /** Multiplicador de congestionamento na partida (1 = fluxo livre). */
  factorAtDeparture: number;
  window: TrafficWindow;
}

export type DriverProfileSource = 'default' | 'learned' | 'override';

export interface RouteIntelligenceReport {
  schedule: RouteScheduleView;
  delays: DelayRiskView[];
  fuel: FuelAdviceView;
  departure: DepartureRecommendationView;
  traffic: TrafficContextView;
  driver: {
    speedFactor: number;
    serviceTimeMinutes: number;
    punctuality: number;
    source: DriverProfileSource;
  };
}
