import { isWorkedDay } from './driver-baseline';
import type { DailyRawRow } from './daily-subject';

/**
 * Que dia mostrar, e quando ele pode ser considerado fechado (ADR-0122).
 *
 * Tudo aqui é função pura de um instante e de um fuso — sem relógio implícito,
 * sem base de dados. É o que torna o horário de verão testável: em vez de
 * esperar por outubro, passa-se o instante.
 */

/**
 * Horas depois da meia-noite local em que o dia deixa de receber correções.
 *
 * Existe porque um evento atrasado — uma entrega marcada às 23h50 e sincronizada
 * às 00h20, uma edição de manhã — muda o dia anterior. Fechar à meia-noite em
 * ponto produziria um resumo que muda depois de a pessoa o ter lido, que é pior
 * do que um resumo que chega um pouco mais tarde.
 */
export const SETTLE_HOURS = 3;

/** De onde veio o fuso usado. A cadeia é declarada, não adivinhada. */
export type TimeZoneSource = 'user' | 'tenant' | 'default';

export interface ResolvedTimeZone {
  zone: string;
  source: TimeZoneSource;
}

/** Padrão de todo o sistema enquanto ninguém escolhe outro. */
export const DEFAULT_ZONE = 'UTC';

/**
 * Perfil → tenant → UTC, dizendo **qual** dos três respondeu.
 *
 * A origem viaja junto porque muda o que a tela pode afirmar: com fuso do
 * próprio motorista, «ontem» é ontem; com o do tenant, é ontem *da operação*, o
 * que pode não ser o dele; com o default, é ontem em UTC e a tela tem de nomear
 * o dia em vez de dizer só «ontem» (ADR-0116).
 */
export function resolveTimeZone(
  userZone: string | null | undefined,
  tenantZone: string | null | undefined,
): ResolvedTimeZone {
  const doUtilizador = userZone?.trim();
  if (doUtilizador && isValidZone(doUtilizador)) return { zone: doUtilizador, source: 'user' };

  const doTenant = tenantZone?.trim();
  if (doTenant && isValidZone(doTenant)) return { zone: doTenant, source: 'tenant' };

  return { zone: DEFAULT_ZONE, source: 'default' };
}

/**
 * Um fuso inválido não pode derrubar o resumo — nem ser usado.
 *
 * Um perfil com `Europe/Lisboa` (que não existe) faria `Intl` lançar dentro da
 * leitura; aqui ele simplesmente não conta, e a cadeia continua para o tenant.
 */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** Dia civil (`YYYY-MM-DD`) de um instante, no fuso dado. */
export function dayIn(at: Date, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Hora local (0–23) de um instante, no fuso dado. */
export function hourIn(at: Date, zone: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', hour12: false }).format(at),
  );
}

/** O dia civil anterior a `day`. Aritmética de calendário, não de duração. */
export function previousDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * O dia que o resumo deve mostrar: **ontem**, no fuso de quem lê.
 *
 * Calculado como «hoje local menos um dia civil», e não como «agora menos 24
 * horas»: no dia em que o relógio recua, 24 horas atrás ainda é hoje, e o
 * resumo mostraria o dia errado exatamente no dia em que ninguém repara.
 */
export function summaryDay(now: Date, zone: string): string {
  return previousDay(dayIn(now, zone));
}

/**
 * O dia já passou a janela segura para correções?
 *
 * `false` significa «ainda pode mudar» — não «não há dados». A tela usa isto
 * para não afirmar como definitivo um número que a projeção ainda vai rever.
 */
export function isSettled(day: string, now: Date, zone: string, hours = SETTLE_HOURS): boolean {
  const hojeLocal = dayIn(now, zone);
  if (day < previousDay(hojeLocal)) return true;
  if (day > previousDay(hojeLocal)) return false;
  return hourIn(now, zone) >= hours;
}

/**
 * O último dia **trabalhado** até `upTo`, inclusive.
 *
 * Folga não é um dia vazio para mostrar: é a ausência de um dia. Quando ontem
 * foi folga, o resumo passa a falar do último dia em que houve trabalho — e a
 * tela nomeia a data, para ninguém achar que foi ontem. Nada disto produz
 * alerta: descansar não gera aviso nenhum (ADR-0118).
 */
export function lastWorkedDay(rows: readonly DailyRawRow[], upTo: string): DailyRawRow | null {
  const candidatos = rows
    .filter((r) => r.day <= upTo && isWorkedDay(r))
    .sort((a, b) => (a.day < b.day ? -1 : 1));
  return candidatos[candidatos.length - 1] ?? null;
}
