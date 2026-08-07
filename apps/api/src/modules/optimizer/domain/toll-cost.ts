import type { AugmentationPoint } from './ports/cost-augmentation.port';
import { haversineKm } from './risk-zone';

/**
 * Custo de portagem por trecho (ADR-0111).
 *
 * ## Por que não se infere da distância
 *
 * Portagem é um fato do troço, não uma função do quilómetro: um percurso longo
 * por via municipal não paga nada, e três quilómetros numa ponte pagam. Derivar
 * custo de portagem da distância produziria um número plausível e sistematica-
 * mente errado — e, pior, faria o "evitar portagens" preferir rotas curtas em
 * vez de rotas sem portagem, que são coisas diferentes.
 *
 * O Matrix API do provedor não devolve custo de portagem. Enquanto não houver
 * uma fonte que o devolva, o custo vem de **pórticos declarados pelo operador**:
 * ponto, raio e valor. É dado que ele conhece (são poucos, e fixos) e que não
 * inventa nada.
 *
 * Sem pórticos configurados, o componente de portagem **não entra** no custo, e
 * o plano declara `tollData: 'absent'` — a ausência é dita, não disfarçada de
 * zero.
 */
export interface TollGate {
  latitude: number;
  longitude: number;
  /** Raio em que a passagem é considerada (km). */
  radiusKm: number;
  /** Valor cobrado na passagem, na moeda do tenant. */
  cost: number;
}

/** Um trecho passa num pórtico quando a rota reta entre A e B o atravessa. */
function crossesGate(from: AugmentationPoint, to: AugmentationPoint, gate: TollGate): boolean {
  // Aproximação deliberada: o pórtico é considerado atravessado quando está
  // "no caminho" — a soma dos desvios até ele não excede o trecho por mais que
  // o próprio raio. É grosseiro perto da precisão de um grafo viário, e é o
  // melhor que se faz sem geometria de rota; por isso o valor é declarado como
  // estimativa, nunca como cobrança.
  const direto = haversineKm(from, to);
  const viaGate = haversineKm(from, gate) + haversineKm(gate, to);
  return viaGate - direto <= gate.radiusKm;
}

/** Custo de portagem estimado do trecho A→B. Zero quando não passa em nenhum. */
export function tollCostBetween(
  from: AugmentationPoint,
  to: AugmentationPoint,
  gates: readonly TollGate[],
): number {
  return gates.reduce((total, gate) => total + (crossesGate(from, to, gate) ? gate.cost : 0), 0);
}

/**
 * Matriz de custo de portagem entre todos os pares.
 *
 * `null` quando não há pórtico configurado: é a diferença entre "esta rota não
 * paga portagem" e "não sabemos quanto esta rota paga", e o plano precisa
 * conseguir dizer as duas coisas.
 */
export function tollMatrix(
  points: readonly AugmentationPoint[],
  gates: readonly TollGate[],
): number[][] | null {
  if (gates.length === 0) return null;
  return points.map((from) =>
    points.map((to) => (from === to ? 0 : tollCostBetween(from, to, gates))),
  );
}
