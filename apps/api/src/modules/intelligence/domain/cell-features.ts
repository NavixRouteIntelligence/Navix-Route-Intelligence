/**
 * Features por célula e contexto temporal (ADR-0089).
 *
 * ## Por que buckets em cascata, e não só hora da semana
 *
 * A hora da semana (168 baldes) é a granularidade em que o trânsito de fato
 * varia, mas é também a que demora mais a encher: uma célula com 20 entregas no
 * mês teria ~1 amostra por balde e nunca atingiria a amostra mínima. O balde
 * mais grosso responde cedo; o mais fino responde melhor.
 *
 * Por isso guardamos os três níveis e escolhemos, na leitura, **o mais
 * específico que tenha amostra suficiente**. É o que faz o sistema ser útil no
 * primeiro mês e ficar mais preciso sozinho, sem religar nada.
 */

/** Amostra mínima por balde — a mesma da agregação coletiva (ADR-0031). */
export const MIN_SAMPLE = 3;

/** Janela de observação considerada nas features. */
export const FEATURE_WINDOW_DAYS = 90;

/** Balde global da célula: a resposta que sempre existe se houver qualquer dado. */
export const BUCKET_ALL = 'all';

/**
 * Períodos do dia. Deliberadamente os mesmos limiares da heurística de trânsito
 * (ADR-0025), para que feature e heurística falem do mesmo recorte — quando o
 * modelo substituir a heurística, a comparação é direta.
 */
export type DayPart = 'madrugada' | 'manha' | 'tarde' | 'noite';

export function dayPart(hour: number): DayPart {
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'manha';
  if (hour < 18) return 'tarde';
  return 'noite';
}

/** Hora da semana: 0 = domingo 00h … 167 = sábado 23h. */
export function hourOfWeek(at: Date): number {
  return at.getDay() * 24 + at.getHours();
}

/**
 * Baldes de um instante, **do mais específico ao mais geral**. É esta ordem que
 * define a cascata na leitura.
 */
export function bucketsFor(at: Date): string[] {
  const day = at.getDay();
  const fimDeSemana = day === 0 || day === 6;
  return [
    `hw:${hourOfWeek(at)}`,
    `dp:${fimDeSemana ? 'fds' : 'util'}:${dayPart(at.getHours())}`,
    BUCKET_ALL,
  ];
}

/** Uma amostra de tempo de atendimento medido, com o instante em que ocorreu. */
export interface ServiceTimeSample {
  minutes: number;
  at: Date;
}

/** Feature materializada de um par (célula, balde). */
export interface CellFeature {
  cell: string;
  bucket: string;
  samples: number;
  /** Mediana do tempo de atendimento medido (min). */
  serviceMinutesP50: number;
}

/** Feature escolhida na leitura, com o balde que a produziu. */
export interface ResolvedFeature extends CellFeature {
  /** `true` quando a resposta veio do balde global, e não do contexto temporal. */
  fallback: boolean;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

/**
 * Constrói **todos** os baldes de uma célula a partir das amostras cruas.
 *
 * Mediana, e não média: um atendimento que travou 40 minutos por causa de uma
 * portaria não pode arrastar o típico da rua inteira. Baldes com menos que a
 * amostra mínima são descartados aqui — materializar um número que a leitura
 * vai ignorar só ocuparia espaço e enganaria quem inspecionar a tabela.
 */
export function buildCellFeatures(cell: string, samples: ServiceTimeSample[]): CellFeature[] {
  const porBucket = new Map<string, number[]>();

  for (const sample of samples) {
    for (const bucket of bucketsFor(sample.at)) {
      const lista = porBucket.get(bucket);
      if (lista) lista.push(sample.minutes);
      else porBucket.set(bucket, [sample.minutes]);
    }
  }

  return [...porBucket.entries()]
    .filter(([, valores]) => valores.length >= MIN_SAMPLE)
    .map(([bucket, valores]) => ({
      cell,
      bucket,
      samples: valores.length,
      serviceMinutesP50: median(valores),
    }));
}

/**
 * Escolhe a feature de um instante: o balde mais específico disponível.
 *
 * Devolve `null` quando a célula não tem nada — e nulo é a resposta certa, não
 * um default. Quem chama já tem o seu próprio padrão (tipo de destino, ADR-0064)
 * e sabe que ele vale mais do que um número inventado.
 */
export function resolveFeature(
  disponiveis: CellFeature[],
  at: Date,
): ResolvedFeature | null {
  const porBucket = new Map(disponiveis.map((f) => [f.bucket, f]));
  for (const bucket of bucketsFor(at)) {
    const feature = porBucket.get(bucket);
    if (feature) return { ...feature, fallback: bucket === BUCKET_ALL };
  }
  return null;
}
