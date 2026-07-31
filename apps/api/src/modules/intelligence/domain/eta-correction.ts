/**
 * Modelo de correção do ETA (ADR-0090) — o primeiro modelo **treinável** da
 * previsão, servido atrás da mesma port que a heurística.
 *
 * ## Por que corrigir o resíduo, e não prever o tempo do zero
 *
 * A heurística já sabe o essencial: distância, ordem das paradas, tempo de
 * serviço. O que ela erra é **sistemático** — parte por não conhecer o trânsito
 * real da região, parte por tratar a rota como se começasse no instante do
 * cálculo. Um modelo que reaprendesse tudo desperdiçaria o que já funciona e
 * precisaria de ordens de magnitude mais dados para empatar.
 *
 * Aprender o resíduo (real − previsto) por contexto captura exatamente a parte
 * que falta, com uma fração das amostras. É o baseline que a literatura de ETA
 * usa como primeiro degrau, e é interpretável: cada parâmetro é "neste contexto,
 * costumamos atrasar N minutos".
 *
 * ## Mediana, não média
 *
 * O resíduo tem cauda longa: uma entrega que travou duas horas num condomínio
 * arrastaria a média e o modelo passaria a atrasar todas as previsões daquele
 * contexto. A mediana absorve o caso raro sem se deixar levar por ele.
 */

/** Amostra mínima por balde antes de confiar numa correção. */
export const MIN_TRAIN_SAMPLE = 10;

/** Uma observação rotulada: o que foi previsto, o que aconteceu, e quando. */
export interface EtaTrainingSample {
  /** Resíduo do **baseline**: real − previsão da heurística, em minutos. */
  baselineErrorMinutes: number;
  /** Baldes do contexto, do mais específico ao mais geral. */
  buckets: string[];
}

/** Correção aprendida para um balde. */
export interface EtaCorrection {
  bucket: string;
  samples: number;
  /** Minutos a somar à previsão da heurística naquele contexto. */
  correctionMinutes: number;
}

/** Resultado da avaliação em dados **não vistos** no treino. */
export interface EtaModelEvaluation {
  /** Amostras do conjunto de teste. */
  testSamples: number;
  /** MAE da heurística sozinha (a régua a bater). */
  baselineMae: number;
  /** MAE com a correção aplicada. */
  modelMae: number;
  /** Redução percentual do MAE. Negativo = o modelo piorou. */
  improvementPct: number;
  /** `true` quando o modelo bate o baseline por margem suficiente. */
  accepted: boolean;
}

/**
 * Margem mínima de melhora para aceitar um modelo.
 *
 * Não é conservadorismo gratuito: com poucas amostras de teste, uma diferença
 * de 1–2% é ruído amostral, e promover um modelo por ruído troca uma heurística
 * que se entende por um número que ninguém sabe explicar. Cinco por cento é
 * pequeno o bastante para não barrar ganho real e grande o bastante para não
 * premiar sorte.
 */
export const MIN_IMPROVEMENT_PCT = 5;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

function mae(errors: number[]): number {
  if (errors.length === 0) return 0;
  const soma = errors.reduce((acc, e) => acc + Math.abs(e), 0);
  return Math.round((soma / errors.length) * 100) / 100;
}

/**
 * Treina as correções por balde a partir das amostras.
 *
 * Baldes abaixo da amostra mínima são descartados: a cascata da leitura cai
 * para o balde mais grosso, que é uma resposta pior mas honesta — melhor que
 * uma correção ajustada em três entregas.
 */
export function trainCorrections(samples: EtaTrainingSample[]): EtaCorrection[] {
  const porBucket = new Map<string, number[]>();

  for (const sample of samples) {
    for (const bucket of sample.buckets) {
      const lista = porBucket.get(bucket);
      if (lista) lista.push(sample.baselineErrorMinutes);
      else porBucket.set(bucket, [sample.baselineErrorMinutes]);
    }
  }

  return [...porBucket.entries()]
    .filter(([, valores]) => valores.length >= MIN_TRAIN_SAMPLE)
    .map(([bucket, valores]) => ({
      bucket,
      samples: valores.length,
      correctionMinutes: median(valores),
    }));
}

/**
 * Correção aplicável num contexto: o balde mais específico disponível.
 * Zero quando não há nada aprendido — a heurística passa intacta.
 */
export function correctionFor(corrections: EtaCorrection[], buckets: string[]): number {
  const porBucket = new Map(corrections.map((c) => [c.bucket, c]));
  for (const bucket of buckets) {
    const found = porBucket.get(bucket);
    if (found) return found.correctionMinutes;
  }
  return 0;
}

/**
 * Avalia o modelo em amostras **não usadas no treino**.
 *
 * A divisão é responsabilidade de quem chama, e precisa ser **temporal**: medir
 * num recorte aleatório deixaria o modelo ver o futuro do próprio conjunto de
 * teste e inflaria o resultado. Em produção ele sempre prevê para frente.
 */
export function evaluateCorrections(
  corrections: EtaCorrection[],
  test: EtaTrainingSample[],
): EtaModelEvaluation {
  const baselineErrors = test.map((s) => s.baselineErrorMinutes);
  // Se costumamos atrasar N minutos, prever N minutos mais tarde reduz o erro:
  // o resíduo do modelo é o resíduo do baseline menos a correção.
  const modelErrors = test.map(
    (s) => s.baselineErrorMinutes - correctionFor(corrections, s.buckets),
  );

  const baselineMae = mae(baselineErrors);
  const modelMae = mae(modelErrors);
  const improvementPct =
    baselineMae === 0
      ? 0
      : Math.round(((baselineMae - modelMae) / baselineMae) * 10000) / 100;

  return {
    testSamples: test.length,
    baselineMae,
    modelMae,
    improvementPct,
    accepted: test.length >= MIN_TRAIN_SAMPLE && improvementPct >= MIN_IMPROVEMENT_PCT,
  };
}

/**
 * Divide as amostras em treino e teste **por tempo**: as mais antigas treinam,
 * as mais recentes avaliam. Espelha o uso real — o modelo sempre prevê para
 * frente — e é a única divisão que não mente sobre o ganho.
 *
 * `samples` deve vir ordenada da mais antiga para a mais recente.
 */
export function splitByTime<T>(
  samples: T[],
  testRatio = 0.3,
): { train: T[]; test: T[] } {
  const corte = Math.floor(samples.length * (1 - testRatio));
  return { train: samples.slice(0, corte), test: samples.slice(corte) };
}
