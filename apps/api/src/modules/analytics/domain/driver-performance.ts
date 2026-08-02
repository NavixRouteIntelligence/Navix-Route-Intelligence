/**
 * Desempenho do motorista (ADR-0097).
 *
 * ## A restrição ética é o desenho, não um aviso no rodapé
 *
 * Gamificação em logística tem um histórico ruim: métrica de volume vira
 * velocidade, sequência de dias vira trabalhar doente, ranking vira corrida. As
 * escolhas abaixo existem para tornar esses efeitos **impossíveis por
 * construção**, não improváveis por bom senso.
 *
 * **O que este módulo deliberadamente NÃO calcula:**
 *
 * - **Nada por hora ou por velocidade.** Entregas/hora e km/h premiariam
 *   dirigir mais rápido e pular pausas. Não existe aqui, e não é omissão.
 * - **Nada comparativo entre motoristas.** Ranking transforma colegas em
 *   concorrentes numa atividade onde a pressa mata. Todo número é do próprio
 *   motorista contra ele mesmo.
 * - **Nada que premie jornada longa.** Horas trabalhadas não pontuam. O tempo
 *   de atividade entra **só** para sugerir descanso (`restAdvice`) — é a única
 *   métrica de jornada, e ela empurra para o lado oposto do "trabalhe mais".
 * - **Nada de km economizado.** Existe no painel da empresa, mas o plano de rota
 *   não guarda motorista: atribuir a economia a quem dirigiu seria um palpite.
 *   Um número inventado num painel de desempenho pessoal é pior que sua
 *   ausência.
 * - **Pontualidade não entra na sequência.** É a decisão menos óbvia e a mais
 *   importante: premiar chegar no prazo é exatamente o que faria alguém correr
 *   para fechar uma janela. Ela aparece como **informação** no consolidado,
 *   nunca como algo a defender.
 */

/** Um dia de trabalho do motorista, já agregado. */
export interface DriverDayRow {
  day: string;
  delivered: number;
  failed: number;
  onTime: number;
  /** Minutos entre a primeira e a última atividade do dia. */
  activeMinutes: number;
}

export interface DriverPerformance {
  from: string;
  to: string;
  delivered: number;
  /** Dias em que houve alguma entrega — a base de todo cálculo por dia. */
  workedDays: number;
  /** Entregues ÷ finalizadas. `null` sem finalizadas. */
  successRate: number | null;
  /** Informativo. Nunca vira meta nem sequência (ver a nota do módulo). */
  onTimeRate: number | null;
  streak: HealthyStreak;
  goal: DriverGoal | null;
  restAdvice: RestAdvice | null;
}

/**
 * Sequência de **dias trabalhados sem entrega falhada**.
 *
 * Duas propriedades a preservar em qualquer mudança futura:
 *
 * 1. **Descansar não quebra.** Dias sem trabalho são pulados, não zeram a
 *    contagem. Uma sequência que exige presença diária é um incentivo a
 *    trabalhar doente, cansado ou no dia de folga.
 * 2. **É qualidade, não assiduidade nem volume.** Entregar 3 ou 30 num dia dá o
 *    mesmo resultado: nenhuma falha é nenhuma falha.
 */
export interface HealthyStreak {
  /** Dias trabalhados consecutivos sem falha. */
  days: number;
  /** `true` quando o dia mais recente entra na contagem. */
  current: boolean;
}

/**
 * Meta **do motorista contra ele mesmo**, sempre uma taxa de qualidade.
 *
 * Nunca um volume: "entregue mais que a semana passada" é um pedido para
 * correr. Uma taxa tem teto natural em 100%, o que impede a escalada infinita
 * que torna metas nocivas — chegando lá, a meta é *manter*, não superar.
 */
export interface DriverGoal {
  /** Taxa alvo (0–1): a própria média do período anterior, com piso. */
  target: number;
  /** Taxa corrente no período. */
  current: number;
  /** `true` quando a meta está sendo cumprida. */
  met: boolean;
}

/**
 * Sugestão de descanso — a única leitura de jornada, e ela aponta para parar.
 *
 * Não é bloqueio nem alerta a quem gerencia: é informação para quem dirige. O
 * limiar segue o intervalo de condução contínua da regulamentação europeia
 * (4h30), que é referência conservadora e reconhecível.
 */
export interface RestAdvice {
  activeMinutes: number;
  /** `true` quando o dia já passou do limiar de condução contínua. */
  longDay: boolean;
}

/** Limiar de jornada para sugerir pausa (min) — 4h30, referência do Reg. (CE) 561/2006. */
export const LONG_DAY_MINUTES = 270;

/** Piso da meta: abaixo disto, a meta é subir, não "manter a própria média". */
export const GOAL_FLOOR = 0.9;

/** Dias mínimos de histórico para propor meta. Menos que isso é ruído. */
export const MIN_DAYS_FOR_GOAL = 5;

const round = (n: number, casas = 4): number => {
  const f = 10 ** casas;
  return Math.round(n * f) / f;
};

function rate(numerador: number, denominador: number): number | null {
  if (denominador <= 0) return null;
  return round(numerador / denominador);
}

/** Um dia conta como trabalhado quando houve desfecho de entrega. */
function worked(row: DriverDayRow): boolean {
  return row.delivered + row.failed > 0;
}

/**
 * Sequência a partir do dia mais recente para trás.
 *
 * `rows` deve vir em ordem cronológica crescente.
 */
export function healthyStreak(rows: DriverDayRow[]): HealthyStreak {
  const trabalhados = rows.filter(worked);
  if (trabalhados.length === 0) return { days: 0, current: false };

  let days = 0;
  for (let i = trabalhados.length - 1; i >= 0; i--) {
    if (trabalhados[i].failed > 0) break;
    days++;
  }

  // `current` diz se o último dia trabalhado entra na sequência — é o que
  // permite à interface falar no presente sem inventar continuidade.
  return { days, current: days > 0 };
}

/**
 * Meta derivada do próprio histórico: a taxa de sucesso do período anterior,
 * nunca abaixo do piso. `null` sem histórico suficiente — propor meta com três
 * dias de dados seria fabricar exigência a partir de ruído.
 */
export function buildGoal(anteriores: DriverDayRow[], atual: DriverDayRow[]): DriverGoal | null {
  const base = anteriores.filter(worked);
  if (base.length < MIN_DAYS_FOR_GOAL) return null;

  const taxa = (rows: DriverDayRow[]): number | null => {
    const entregues = rows.reduce((a, r) => a + r.delivered, 0);
    const finalizadas = rows.reduce((a, r) => a + r.delivered + r.failed, 0);
    return rate(entregues, finalizadas);
  };

  const historica = taxa(base);
  const corrente = taxa(atual);
  if (historica === null || corrente === null) return null;

  const target = round(Math.max(historica, GOAL_FLOOR), 2);
  return { target, current: corrente, met: corrente >= target };
}

/** Sugestão de descanso do dia mais recente. `null` sem atividade registrada. */
export function restAdviceFor(hoje: DriverDayRow | undefined): RestAdvice | null {
  if (!hoje || hoje.activeMinutes <= 0) return null;
  return { activeMinutes: hoje.activeMinutes, longDay: hoje.activeMinutes >= LONG_DAY_MINUTES };
}

/**
 * Consolida o desempenho do período.
 *
 * `rows` em ordem cronológica; `anteriores` é o período imediatamente anterior,
 * usado só para derivar a meta.
 */
export function summarizeDriverPerformance(
  rows: DriverDayRow[],
  anteriores: DriverDayRow[],
  from: string,
  to: string,
): DriverPerformance {
  const delivered = rows.reduce((a, r) => a + r.delivered, 0);
  const failed = rows.reduce((a, r) => a + r.failed, 0);
  const onTime = rows.reduce((a, r) => a + r.onTime, 0);

  return {
    from,
    to,
    delivered,
    workedDays: rows.filter(worked).length,
    successRate: rate(delivered, delivered + failed),
    onTimeRate: rate(onTime, delivered),
    streak: healthyStreak(rows),
    goal: buildGoal(anteriores, rows),
    restAdvice: restAdviceFor(rows[rows.length - 1]),
  };
}
