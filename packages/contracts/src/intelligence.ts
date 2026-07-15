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

/** Dificuldade prevista de estacionamento no destino (ADR-0029). */
export type ParkingDifficulty = 'easy' | 'moderate' | 'hard';

export interface ParkingPredictionView {
  difficulty: ParkingDifficulty;
  /** Confiança da previsão, 0..1. */
  confidence: number;
  /** Caminhada estimada do estacionamento até a porta (min). */
  walkMinutes: number;
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
  /** Previsão de estacionamento no destino (ADR-0029). */
  parking?: ParkingPredictionView;
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

/**
 * Organização otimizada da carga (ADR-0030). Item a carregar, na ordem de
 * entrega pretendida (`sequence` = 1 é a **primeira** parada a ser entregue).
 */
export interface LoadItemInput {
  id: string;
  /** Ordem de entrega (1 = primeira a sair). */
  sequence: number;
  /** Peso do item (kg). Opcional; default 0. */
  weightKg?: number;
  /** Volume do item (m³). Opcional; default 0. */
  volumeM3?: number;
  /** Item frágil — deve ficar por cima, sem carga pesada em cima. */
  fragile?: boolean;
  /** Rótulo curto (ex.: cliente/nota). Apenas apresentação. */
  label?: string;
}

export interface LoadPlanRequest {
  items: LoadItemInput[];
  vehicleType?: VehicleType;
  /** Capacidade de peso do veículo (kg). Default: pelo tipo, se informado. */
  capacityKg?: number;
  /** Capacidade de volume do veículo (m³). Default: pelo tipo, se informado. */
  capacityVolumeM3?: number;
}

/** Zona de estiva sugerida — porta (acesso fácil) → fundo (carregado primeiro). */
export type LoadZone = 'door' | 'middle' | 'front';

export interface LoadPlacementView {
  id: string;
  label?: string;
  /** Ordem de **carregamento** (1 = carregado primeiro, vai ao fundo). */
  loadOrder: number;
  /** Ordem de **entrega** de origem (1 = primeira a sair). */
  deliverySequence: number;
  zone: LoadZone;
  weightKg: number;
  volumeM3: number;
  fragile: boolean;
}

export interface LoadPlanView {
  /** Itens na ordem de carregamento (LIFO: última entrega no fundo). */
  placements: LoadPlacementView[];
  totalWeightKg: number;
  totalVolumeM3: number;
  /** Capacidade considerada; null quando não informada nem derivável do tipo. */
  capacityKg: number | null;
  capacityVolumeM3: number | null;
  /** Ocupação 0..1; null quando não há capacidade de referência. */
  weightUtilization: number | null;
  volumeUtilization: number | null;
  /** Excede a capacidade de peso ou volume. */
  overCapacity: boolean;
  /** Avisos operacionais (excesso, frágil sob carga, etc.). */
  warnings: string[];
}

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
