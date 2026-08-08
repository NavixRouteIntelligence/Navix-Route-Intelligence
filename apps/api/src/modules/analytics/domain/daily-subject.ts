import type { VehicleType } from '@navix/contracts';

/**
 * Sujeito de um dia no read model (ADR-0117).
 *
 * A ficha quando existe; o **login** quando não existe. O motorista autónomo
 * não tem ficha (ADR-0085) e ficava de fora da tabela feita para o resumo por
 * motorista — a projeção filtrava `driver_id IS NOT NULL`.
 */
export type DailySubject = { kind: 'driver'; driverId: string } | { kind: 'user'; userId: string };

/** Litros por 100 km, por tipo de veículo — a base de [savedFuelLitersOf]. */
const CONSUMPTION_PER_100KM: Record<VehicleType, number> = {
  bicycle: 0,
  motorcycle: 3,
  car: 8,
  van: 11,
  truck: 28,
};

/**
 * Linha crua do dia. Tudo o que é **contado** fica gravado; tudo o que é
 * **taxa** ou **estimativa** é derivado na leitura.
 */
export interface DailyRawRow {
  day: string;
  delivered: number;
  failed: number;
  onTime: number;
  /** Instantes crus da atividade. `null` quando não houve atividade registada. */
  firstActivityAt: Date | null;
  lastActivityAt: Date | null;
  /** Planos atribuíveis à pessoa no dia. */
  plans: number;
  savedKm: number | null;
  savedMinutes: number | null;
  /** Tipos de veículo dos planos do dia — o ingrediente da estimativa. */
  vehicleTypes: VehicleType[];
  projectedAt: Date;
}

/**
 * Duração da atividade, **ou `null`**.
 *
 * A coluna anterior era `NOT NULL DEFAULT 0`, e zero dizia duas coisas
 * incompatíveis: "não trabalhou" e "não sabemos". Com um só instante registado
 * não há duração — há um carimbo. Devolver zero aí seria afirmar que a pessoa
 * trabalhou nada, que é o oposto do que os dados dizem.
 */
export function activeMinutesOf(row: DailyRawRow): number | null {
  if (!row.firstActivityAt || !row.lastActivityAt) return null;
  const ms = row.lastActivityAt.getTime() - row.firstActivityAt.getTime();
  if (ms <= 0) return null;
  return Math.round(ms / 60_000);
}

/** Entregues ÷ finalizadas. `null` sem finalizadas — nunca 0%. */
export function successRateOf(row: DailyRawRow): number | null {
  const finalizadas = row.delivered + row.failed;
  return finalizadas > 0 ? row.delivered / finalizadas : null;
}

/** Dentro da janela ÷ entregues. `null` sem entregues. */
export function onTimeRateOf(row: DailyRawRow): number | null {
  return row.delivered > 0 ? row.onTime / row.delivered : null;
}

/**
 * Combustível poupado — **estimativa**, e só quando atribuível (ADR-0116).
 *
 * Devolve `null` quando não há distância poupada, quando o dia misturou tipos
 * de veículo (não há um consumo do dia) ou quando o tipo é desconhecido. Não
 * fica gravado de propósito: gravá-lo congelaria uma estimativa como se fosse
 * facto, e uma correção futura da constante não alcançaria o histórico.
 */
export function savedFuelLitersOf(row: DailyRawRow): number | null {
  if (row.savedKm === null || row.savedKm <= 0) return null;
  if (row.vehicleTypes.length !== 1) return null;
  const consumo = CONSUMPTION_PER_100KM[row.vehicleTypes[0]];
  if (consumo === undefined || consumo === 0) return null;
  return Math.round((row.savedKm / 100) * consumo * 100) / 100;
}
