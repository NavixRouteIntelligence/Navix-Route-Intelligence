import {
  errorsForContext,
  estimateBreachRisk,
  MIN_RISK_SAMPLE,
  type ErrorSample,
} from './breach-risk';
import { hourOfWeek } from './cell-features';

/** Terça-feira 09h — o contexto usado em todo o arquivo. */
const terca9h = new Date(2026, 6, 28, 9, 0);
const HW_TERCA_9H = hourOfWeek(terca9h);

const chegada = (minutosAntesDoFim: number): { previsto: Date; fim: Date } => {
  const previsto = new Date(2026, 6, 28, 9, 0);
  return { previsto, fim: new Date(previsto.getTime() + minutosAntesDoFim * 60_000) };
};

/** N erros iguais, no contexto de terça 09h. */
const erros = (n: number, minutos: number, hw = HW_TERCA_9H): ErrorSample[] =>
  Array.from({ length: n }, () => ({ errorMinutes: minutos, hourOfWeek: hw }));

describe('estimateBreachRisk', () => {
  // O caso que a ADR-0025 não enxergava: chega "a tempo" pelo ponto estimado,
  // mas numa operação que costuma atrasar bem mais que a folga restante.
  it('acusa risco alto mesmo com a previsão dentro da janela', () => {
    const { previsto, fim } = chegada(5); // 5 min de folga
    const historico = [...erros(30, 25)].map((e) => e.errorMinutes); // erra +25 min

    const risco = estimateBreachRisk(previsto, fim, historico);

    expect(risco).toMatchObject({ slackMinutes: 5, probability: 1, level: 'high' });
  });

  it('folga larga em operação pontual dá risco baixo', () => {
    const { previsto, fim } = chegada(90);
    const historico = erros(30, 5).map((e) => e.errorMinutes);

    const risco = estimateBreachRisk(previsto, fim, historico);

    expect(risco).toMatchObject({ probability: 0, level: 'low' });
  });

  it('probabilidade é a fração observada que excede a folga', () => {
    const { previsto, fim } = chegada(10);
    // 40 amostras: 16 acima de 10 min (40%), 24 abaixo.
    const historico = [
      ...erros(16, 30).map((e) => e.errorMinutes),
      ...erros(24, 2).map((e) => e.errorMinutes),
    ];

    const risco = estimateBreachRisk(previsto, fim, historico);

    expect(risco?.probability).toBe(0.4);
    expect(risco?.level).toBe('medium');
    expect(risco?.samples).toBe(40);
  });

  // Já estourou no cronograma: não é mais estimativa, é constatação.
  it('previsão além da janela é certeza, não probabilidade', () => {
    const { previsto, fim } = chegada(-15);
    const historico = erros(30, 0).map((e) => e.errorMinutes);

    const risco = estimateBreachRisk(previsto, fim, historico);

    expect(risco).toMatchObject({ probability: 1, level: 'high', slackMinutes: -15 });
  });

  // Sem base, afirmar "risco baixo" seria inventar uma garantia — e é no começo,
  // com corpus pequeno, que um falso "está tudo bem" faria mais estrago.
  it('sem histórico suficiente devolve null, não risco baixo', () => {
    const { previsto, fim } = chegada(10);

    expect(estimateBreachRisk(previsto, fim, null)).toBeNull();
    expect(
      estimateBreachRisk(previsto, fim, erros(MIN_RISK_SAMPLE - 1, 30).map((e) => e.errorMinutes)),
    ).toBeNull();
  });

  it('chegar adiantado no histórico não conta como estouro', () => {
    const { previsto, fim } = chegada(10);
    const historico = erros(20, -30).map((e) => e.errorMinutes);

    expect(estimateBreachRisk(previsto, fim, historico)?.probability).toBe(0);
  });
});

describe('errorsForContext', () => {
  it('prefere o contexto específico quando ele tem amostra', () => {
    const samples = [
      ...erros(MIN_RISK_SAMPLE, 40), // terça 09h: atrasa muito
      ...erros(50, 1, hourOfWeek(new Date(2026, 7, 2, 15))), // domingo tarde: pontual
    ];

    const contexto = errorsForContext(samples, terca9h);

    expect(contexto).toHaveLength(MIN_RISK_SAMPLE);
    expect(contexto?.every((e) => e === 40)).toBe(true);
  });

  // O primeiro mês: nenhum contexto fino encheu, mas o global já responde.
  it('cai para o balde global quando o contexto fino não encheu', () => {
    const samples = [
      ...erros(5, 40),
      ...erros(10, 10, hourOfWeek(new Date(2026, 6, 28, 15))), // terça tarde
    ];

    const contexto = errorsForContext(samples, terca9h);

    expect(contexto).toHaveLength(15);
  });

  it('sem amostra nem no global, devolve null', () => {
    expect(errorsForContext(erros(3, 10), terca9h)).toBeNull();
    expect(errorsForContext([], terca9h)).toBeNull();
  });
});
