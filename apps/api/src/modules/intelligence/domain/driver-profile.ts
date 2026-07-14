/**
 * IA personalizada por motorista (ADR-0025): um **perfil aprendido** dos padrões
 * individuais. Nesta camada, o aprendizado é estatístico (médias sobre o
 * histórico); a mesma estrutura recebe, no futuro, um modelo de ML por motorista
 * — os consumidores (scheduler) só conhecem o `DriverProfile`.
 */
export interface DriverProfile {
  /** Multiplicador da velocidade base (1 = neutro; motorista mais rápido > 1). */
  speedFactor: number;
  /** Tempo médio de atendimento por parada (min). */
  serviceTimeMinutes: number;
  /** Pontualidade histórica (fração de janelas cumpridas), 0..1. */
  punctuality: number;
}

export const NEUTRAL_DRIVER_PROFILE: DriverProfile = {
  speedFactor: 1,
  serviceTimeMinutes: 5,
  punctuality: 0.9,
};

/** Amostra observada do histórico de um motorista. */
export interface DriverSample {
  /** Velocidade média observada num trecho (km/h). */
  speedKmh: number;
  /** Tempo de atendimento observado numa parada (min). */
  serviceMinutes: number;
  /** A janela da parada foi cumprida? */
  onTime: boolean;
}

const round = (n: number, d = 2): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * "Aprende" o perfil a partir do histórico. Poucas amostras → mantém o neutro
 * (evita conclusões instáveis). O `speedFactor` é limitado a [0.5, 1.8] para não
 * extrapolar em dados ruidosos.
 */
export function learnDriverProfile(
  samples: DriverSample[],
  baseSpeedKmh: number,
  minSamples = 3,
): DriverProfile {
  if (samples.length < minSamples || baseSpeedKmh <= 0) return NEUTRAL_DRIVER_PROFILE;
  return {
    speedFactor: round(clamp(mean(samples.map((s) => s.speedKmh)) / baseSpeedKmh, 0.5, 1.8)),
    serviceTimeMinutes: round(mean(samples.map((s) => s.serviceMinutes)), 1),
    punctuality: round(samples.filter((s) => s.onTime).length / samples.length),
  };
}
