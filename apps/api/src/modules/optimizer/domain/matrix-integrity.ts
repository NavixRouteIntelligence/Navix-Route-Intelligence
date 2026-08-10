import { UNREACHABLE } from './reachability';

/**
 * Integridade da matriz devolvida pelo provedor (ADR-0126).
 *
 * O provedor pode devolver três coisas diferentes que se parecem: **não há
 * rota**, **há rota e falta-me um dos números**, e **resposta partida**. Tratar
 * as três como uma só foi o que produziu os defeitos desta revisão — uma célula
 * sem duração passava a proibida, e uma linha curta virava proibição silenciosa.
 */

/** Célula crua: metros e segundos, qualquer um podendo faltar. */
export interface RawCell {
  meters: number | null;
  seconds: number | null;
}

export interface NormalizedCell {
  km: number;
  minutes: number;
}

/** Distância geométrica de reserva, para quando falta um dos dois números. */
export interface GeometricFallbackCell {
  km: number;
  minutes: number;
}

/**
 * Converte uma célula crua, preenchendo o que falta com a geometria.
 *
 * As três leituras, e por que são diferentes:
 *
 * - **Os dois nulos** — o provedor está a dizer que não há rota entre o par.
 *   Vira `UNREACHABLE` (ADR-0106): zero seria a aresta mais barata do grafo e o
 *   otimizador escolheria justamente as impossíveis.
 * - **Distância presente, duração nula** — o par *é* alcançável; só falta o
 *   tempo. Marcá-lo proibido apagaria uma perna que existe. Usa-se a duração
 *   geométrica, que é uma estimativa honesta para um trecho que se sabe
 *   percorrível. **Nunca zero:** duração zero num trecho com distância diria
 *   que a viagem é instantânea, e um objetivo de tempo (ADR-0111) escolheria
 *   exatamente esse trecho.
 * - **Duração presente, distância nula** — o simétrico, e igualmente possível.
 */
export function normalizeCell(raw: RawCell, geometric: GeometricFallbackCell): NormalizedCell {
  const semDistancia = raw.meters === null;
  const semDuracao = raw.seconds === null;

  if (semDistancia && semDuracao) return { km: UNREACHABLE, minutes: UNREACHABLE };

  return {
    km: semDistancia ? geometric.km : raw.meters! / 1000,
    minutes: semDuracao ? geometric.minutes : raw.seconds! / 60,
  };
}

/**
 * A resposta tem a forma prometida?
 *
 * Antes, uma linha mais curta do que o esperado era lida com `?.[b] ?? null` e
 * virava célula proibida — uma resposta truncada produzia proibições que o
 * provedor nunca afirmou, e o plano saía a contornar ruas que existem. Agora
 * uma matriz com a forma errada é **erro**, e erro cai no fallback declarado.
 */
export function assertMatrixShape(
  matrix: (number | null)[][] | undefined,
  rows: number,
  cols: number,
  nome: string,
): asserts matrix is (number | null)[][] {
  if (!Array.isArray(matrix) || matrix.length !== rows) {
    throw new Error(`matriz de ${nome} com ${matrix?.length ?? 0} linhas; esperado ${rows}`);
  }
  for (const [i, row] of matrix.entries()) {
    if (!Array.isArray(row) || row.length !== cols) {
      throw new Error(
        `matriz de ${nome}: linha ${i} com ${Array.isArray(row) ? row.length : 0} colunas; esperado ${cols}`,
      );
    }
  }
}

/**
 * Os valores são utilizáveis?
 *
 * `null` é legítimo — significa ausência, e a normalização trata dela. O que
 * não é legítimo é `NaN`, infinito ou negativo: um deles atravessaria o motor
 * inteiro e sairia como custo, sem nada a assinalar. Distância negativa não
 * existe; `NaN` compara falso com tudo e faz o solver escolher ao acaso.
 */
export function assertFiniteCells(matrix: (number | null)[][], nome: string): void {
  for (const [i, row] of matrix.entries()) {
    for (const [j, valor] of row.entries()) {
      if (valor === null) continue;
      if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0) {
        throw new Error(`matriz de ${nome}: valor inválido em [${i}][${j}]`);
      }
    }
  }
}
