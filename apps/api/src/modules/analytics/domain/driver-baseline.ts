import { activeMinutesOf, onTimeRateOf, successRateOf, type DailyRawRow } from './daily-subject';

/**
 * Baseline pessoal: o motorista comparado **consigo próprio** (ADR-0118).
 *
 * Tudo aqui é função pura de uma lista de dias — sem relógio, sem base de
 * dados, sem aleatoriedade. A mesma entrada dá sempre a mesma saída, o que é o
 * que torna um resumo diário auditável: dá para reproduzir a conclusão a partir
 * das linhas que a produziram.
 *
 * ## O que não existe, de propósito
 *
 * Não há função que receba dados de outra pessoa. Não é omissão nem controlo de
 * acesso: é ausência de superfície. Sem entrada para "os outros", não há
 * ranking, percentil de frota nem média da equipa — nem por acidente nem por
 * pressão futura.
 */

/** Dias trabalhados usados como referência. Sete é o pedido da T7.3. */
export const BASELINE_DAYS = 7;

/**
 * Mínimo de dias trabalhados para haver referência.
 *
 * Com um ou dois dias, a "mediana" é o próprio dia ou a média de dois — e
 * declarar evolução a partir disso é inventar tendência a partir de ruído.
 */
export const MIN_SAMPLE = 3;

/**
 * Variação relativa a partir da qual um indicador deixa de ser estável.
 *
 * 25% é grosseiro de propósito. Abaixo disso, a diferença é indistinguível de
 * um dia normal — e apontá-la todos os dias ensina a ignorar o resumo.
 */
export const RELATIVE_THRESHOLD = 0.25;

/**
 * Variação absoluta mínima em contagens.
 *
 * Sem isto, 1 → 2 entregas é "+100%" e dispararia atenção num dia que não diz
 * nada. Aplica-se só a contagens; taxas usam [RATE_THRESHOLD].
 */
export const MIN_ABSOLUTE_DELTA = 2;

/** Variação mínima em pontos de taxa (0–1) para deixar de ser estável. */
export const RATE_THRESHOLD = 0.1;

/** Variação mínima em minutos de atividade. Uma hora, não dois minutos. */
export const ACTIVE_MINUTES_DELTA = 60;

/**
 * Direção do que é "melhor" em cada indicador.
 *
 * `higher-is-better` — mais entregas concluídas, maior taxa de sucesso.
 *
 * `longer-deserves-attention` — o tempo ativo. É o inverso, e a razão é
 * deliberada: classificar um dia mais longo como "melhorou" transformaria o
 * resumo num incentivo a esticar a jornada, que é exatamente o que a ADR-0097
 * proíbe. Um dia mais curto também não é "melhorou" — descanso não é
 * desempenho, e enquadrá-lo como tal é a mesma pressão pelo avesso.
 */
export type Direction = 'higher-is-better' | 'longer-deserves-attention';

export type Trend = 'improved' | 'stable' | 'attention' | 'building-history';

export interface Indicator {
  /** Valor do último dia trabalhado. `null` quando não há denominador válido. */
  current: number | null;
  /** Mediana dos dias trabalhados anteriores. `null` sem amostra suficiente. */
  baseline: number | null;
  trend: Trend;
  /** Dias trabalhados que entraram na mediana. */
  sample: number;
  /**
   * `true` quando o indicador **não** gera ação nem meta — só informa.
   * A pontualidade é assim por decisão: ver [comparePersonalBaseline].
   */
  informative?: true;
}

export interface PersonalBaseline {
  /** Dia comparado (`YYYY-MM-DD`). `null` quando não há dia trabalhado. */
  day: string | null;
  delivered: Indicator;
  successRate: Indicator;
  onTimeRate: Indicator;
  activeMinutes: Indicator;
}

/** Dia com trabalho registado. Dia sem entregas finalizadas **não** conta. */
export function isWorkedDay(row: DailyRawRow): boolean {
  return row.delivered + row.failed > 0;
}

/** Mediana de uma amostra não vazia. Par: média dos dois centrais. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const ordenado = [...values].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 1 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
}

/**
 * Desvio absoluto mediano — a dispersão habitual da própria pessoa.
 *
 * É o tratamento de outlier: quem varia muito de um dia para o outro não deve
 * receber "merece atenção" por mais um dia dentro da sua própria variação, e
 * quem é muito regular merece que uma diferença pequena conte. Um limiar fixo
 * sozinho trata os dois casos como se fossem o mesmo.
 */
export function medianAbsoluteDeviation(values: readonly number[]): number | null {
  const centro = median(values);
  if (centro === null) return null;
  return median(values.map((v) => Math.abs(v - centro)));
}

/**
 * Compara o último dia trabalhado com a mediana dos anteriores (ADR-0118).
 *
 * `rows` são as linhas cruas do read model, em qualquer ordem — a função ordena
 * por dia. Dias sem trabalho são **ignorados**, e é isso que faz o descanso não
 * quebrar nada: folgar não entra na conta, não interrompe a série e não muda a
 * referência.
 *
 * A pontualidade sai marcada `informative`. Ela é comparada e mostrada, mas
 * nunca gera ação nem meta: a única forma de "recuperar" pontualidade perdida é
 * conduzir mais depressa, e um resumo que pede isso está a pedir um risco. Por
 * isso ela também nunca é classificada como `attention` — ver [tendencia].
 */
export function comparePersonalBaseline(rows: readonly DailyRawRow[]): PersonalBaseline {
  const trabalhados = [...rows]
    .filter(isWorkedDay)
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));

  const ultimo = trabalhados[trabalhados.length - 1];
  if (!ultimo) return semHistorico(null);

  const anteriores = trabalhados.slice(-1 - BASELINE_DAYS, -1);

  return {
    day: ultimo.day,
    delivered: montar(
      ultimo.delivered,
      amostrar(anteriores.map((d) => d.delivered)),
      MIN_ABSOLUTE_DELTA,
      'higher-is-better',
    ),
    successRate: montar(
      successRateOf(ultimo),
      amostrar(anteriores.map(successRateOf)),
      RATE_THRESHOLD,
      'higher-is-better',
    ),
    onTimeRate: {
      ...montar(
        onTimeRateOf(ultimo),
        amostrar(anteriores.map(onTimeRateOf)),
        RATE_THRESHOLD,
        'higher-is-better',
        true,
      ),
      informative: true,
    },
    activeMinutes: {
      ...montar(
        activeMinutesOf(ultimo),
        amostrar(anteriores.map(activeMinutesOf)),
        ACTIVE_MINUTES_DELTA,
        'longer-deserves-attention',
      ),
      informative: true,
    },
  };
}

function semHistorico(day: string | null): PersonalBaseline {
  const vazio: Indicator = { current: null, baseline: null, trend: 'building-history', sample: 0 };
  return {
    day,
    delivered: vazio,
    successRate: vazio,
    onTimeRate: { ...vazio, informative: true },
    activeMinutes: { ...vazio, informative: true },
  };
}

/** Descarta os dias em que o indicador não tinha denominador válido. */
function amostrar(historico: readonly (number | null)[]): number[] {
  return historico.filter((v): v is number => v !== null);
}

function montar(
  current: number | null,
  amostra: readonly number[],
  minAbsoluto: number,
  direcao: Direction,
  informativo = false,
): Indicator {
  // Amostra insuficiente é "a construir histórico", não "estável": estável
  // afirma que nada mudou, e aqui não se sabe.
  if (amostra.length < MIN_SAMPLE || current === null) {
    return {
      current,
      baseline: amostra.length >= MIN_SAMPLE ? median(amostra) : null,
      trend: 'building-history',
      sample: amostra.length,
    };
  }

  const baseline = median(amostra)!;
  return {
    current,
    baseline,
    trend: tendencia(current, baseline, amostra, minAbsoluto, direcao, informativo),
    sample: amostra.length,
  };
}

/**
 * Melhorou, estável ou merece atenção.
 *
 * Só sai de `stable` quando a diferença passa **os três** filtros: relativa
 * (25%), absoluta (2 unidades ou 0,1 de taxa) e maior que a dispersão habitual
 * da própria pessoa. Os três existem por razões distintas — o relativo evita
 * ruído em números grandes, o absoluto evita drama em números pequenos, e o
 * MAD evita acusar de anormal quem simplesmente varia.
 *
 * A pontualidade nunca desce para `attention`: informa e não cobra. Uma queda
 * de pontualidade classificada como "merece atenção" é, na prática, um pedido
 * para conduzir mais depressa.
 */
function tendencia(
  current: number,
  baseline: number,
  amostra: readonly number[],
  minAbsoluto: number,
  direcao: Direction,
  informativo: boolean,
): Trend {
  const delta = current - baseline;
  const absoluto = Math.abs(delta);
  const dispersao = medianAbsoluteDeviation(amostra) ?? 0;

  const relevante =
    absoluto >= minAbsoluto &&
    (baseline === 0 ? absoluto > 0 : absoluto / Math.abs(baseline) >= RELATIVE_THRESHOLD) &&
    absoluto > dispersao;

  if (!relevante) return 'stable';

  if (direcao === 'longer-deserves-attention') {
    // Dia mais longo do que o habitual é sinal de descanso, não conquista; dia
    // mais curto não é nada — e chamar-lhe "melhorou" premiaria a folga como se
    // fosse produtividade.
    return delta > 0 ? 'attention' : 'stable';
  }

  if (delta > 0) return 'improved';
  return informativo ? 'stable' : 'attention';
}
