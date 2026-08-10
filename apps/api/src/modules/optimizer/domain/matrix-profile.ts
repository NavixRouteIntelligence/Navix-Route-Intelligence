import type { RoutingProfile } from './routing-profile';

/**
 * `driving` ou `driving-traffic`? (ADR-0126)
 *
 * ## A correção de facto
 *
 * O perfil `mapbox/driving` **não** inclui trânsito em tempo real. Ele usa
 * velocidades típicas da via. Quem inclui trânsito é `mapbox/driving-traffic`,
 * e a documentação deste módulo afirmava o contrário — o que importa desde que
 * a duração virou objetivo (ADR-0111): «menor tempo» a otimizar sobre
 * velocidades típicas é uma coisa; sobre trânsito atual é outra, e ninguém
 * sabia qual estava a receber.
 *
 * ## As duas condições
 *
 * `driving-traffic` só se justifica quando as duas se verificam:
 *
 * 1. **A rota parte agora.** Trânsito é uma leitura do instante. Aplicá-lo a
 *    uma rota planeada para amanhã de manhã não é mais preciso — é ruído com
 *    aparência de precisão, e o resultado muda conforme a hora em que alguém
 *    carregou no botão.
 * 2. **Cabe no limite.** `driving-traffic` aceita **10** coordenadas por
 *    requisição, contra 25 do `driving`. Acima disso o ladrilhamento
 *    multiplicaria as chamadas — 30 pontos passariam de 9 para 36 requisições —
 *    e o Matrix cobra por elemento.
 */

/** Coordenadas por requisição, por perfil. `driving-traffic` é mais apertado. */
export const MAX_COORDS_BY_PROFILE: Record<RoutingProfile, number> = {
  driving: 25,
  'driving-traffic': 10,
  cycling: 25,
  walking: 25,
};

/**
 * Minutos a partir dos quais uma partida deixa de ser «agora».
 *
 * Meia hora é generoso o suficiente para cobrir o intervalo entre planear e
 * sair, e curto o suficiente para não aplicar o trânsito das 9h a uma rota das
 * 15h.
 */
export const TRAFFIC_HORIZON_MINUTES = 30;

export interface ProfileChoice {
  profile: RoutingProfile;
  /** Por que este perfil, para o log e para a métrica. */
  reason: 'traffic-window' | 'not-departing-now' | 'too-many-points' | 'not-driving';
}

/**
 * Escolhe o perfil da matriz.
 *
 * `departureAt` ausente significa **não se sabe quando parte** — e não se sabe
 * é tratado como «não é agora». Assumir o contrário faria toda rota sem horário
 * receber o trânsito do momento do cálculo.
 */
export function chooseMatrixProfile(input: {
  base: RoutingProfile;
  points: number;
  departureAt?: Date | null;
  now?: Date;
}): ProfileChoice {
  const { base, points } = input;

  // Só o carro tem variante com trânsito. Bicicleta e a pé não a têm, e o
  // camião já é uma aproximação declarada (ADR-0108) — trocar-lhe o perfil
  // acrescentaria imprecisão a uma imprecisão conhecida.
  if (base !== 'driving') return { profile: base, reason: 'not-driving' };

  const partida = input.departureAt;
  if (!partida) return { profile: 'driving', reason: 'not-departing-now' };

  const agora = input.now ?? new Date();
  const minutos = Math.abs(partida.getTime() - agora.getTime()) / 60_000;
  if (minutos > TRAFFIC_HORIZON_MINUTES) {
    return { profile: 'driving', reason: 'not-departing-now' };
  }

  if (points > MAX_COORDS_BY_PROFILE['driving-traffic']) {
    return { profile: 'driving', reason: 'too-many-points' };
  }

  return { profile: 'driving-traffic', reason: 'traffic-window' };
}
