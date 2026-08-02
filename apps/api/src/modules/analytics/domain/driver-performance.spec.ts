import {
  buildGoal,
  GOAL_FLOOR,
  healthyStreak,
  LONG_DAY_MINUTES,
  MIN_DAYS_FOR_GOAL,
  restAdviceFor,
  summarizeDriverPerformance,
  type DriverDayRow,
} from './driver-performance';

function dia(over: Partial<DriverDayRow> = {}): DriverDayRow {
  return {
    day: '2026-07-30',
    delivered: 0,
    failed: 0,
    onTime: 0,
    activeMinutes: 0,
    ...over,
  };
}

/** N dias trabalhados sem falha, em sequência. */
const limpos = (n: number, desde = 1): DriverDayRow[] =>
  Array.from({ length: n }, (_, i) =>
    dia({ day: `2026-07-${String(desde + i).padStart(2, '0')}`, delivered: 5, onTime: 5 }),
  );

const PERIODO = { from: '2026-07-01', to: '2026-07-31' };

describe('healthyStreak — a sequência não pode punir descanso', () => {
  it('conta dias trabalhados sem falha', () => {
    expect(healthyStreak(limpos(4))).toEqual({ days: 4, current: true });
  });

  // A propriedade central: uma sequência que exige presença diária é um
  // incentivo a trabalhar doente, cansado ou na folga.
  it('folga NÃO quebra a sequência', () => {
    const rows = [
      ...limpos(2, 1),
      dia({ day: '2026-07-03' }), // folga: zero entregas
      dia({ day: '2026-07-04' }), // folga
      ...limpos(2, 5),
    ];

    expect(healthyStreak(rows).days).toBe(4);
  });

  it('uma falha quebra — é qualidade, não assiduidade', () => {
    const rows = [
      ...limpos(3, 1),
      dia({ day: '2026-07-04', delivered: 5, failed: 1 }),
      ...limpos(2, 5),
    ];

    expect(healthyStreak(rows).days).toBe(2);
  });

  // Volume não pontua: quem faz 3 entregas e quem faz 30 têm o mesmo dia limpo.
  it('não premia volume', () => {
    const poucas = healthyStreak([dia({ day: '2026-07-01', delivered: 3 })]);
    const muitas = healthyStreak([dia({ day: '2026-07-01', delivered: 30 })]);

    expect(poucas).toEqual(muitas);
  });

  // Pontualidade fora da sequência, de propósito: premiar chegar no prazo é o
  // que faria alguém correr para fechar uma janela.
  it('atraso NÃO quebra a sequência', () => {
    const rows = [dia({ day: '2026-07-01', delivered: 5, onTime: 0 })];

    expect(healthyStreak(rows).days).toBe(1);
  });

  it('sem dia trabalhado, não há sequência', () => {
    expect(healthyStreak([])).toEqual({ days: 0, current: false });
    expect(healthyStreak([dia(), dia({ day: '2026-07-02' })])).toEqual({
      days: 0,
      current: false,
    });
  });
});

describe('buildGoal — meta contra si mesmo, com teto', () => {
  it('a meta é a própria média anterior', () => {
    // Cinco dias de 9 entregues e 1 falhada: 45 de 50 = 0,9 exato.
    const anteriores = Array.from({ length: MIN_DAYS_FOR_GOAL }, (_, i) =>
      dia({ day: `2026-07-0${i + 1}`, delivered: 9, failed: 1 }),
    );
    const atual = [dia({ day: '2026-07-10', delivered: 10 })];

    const meta = buildGoal(anteriores, atual);

    expect(meta?.target).toBe(0.9);
    expect(meta?.current).toBe(1);
    expect(meta?.met).toBe(true);
  });

  // Uma taxa tem teto em 100%: chegando lá, a meta é manter, não superar. É o
  // que impede a escalada infinita que torna metas nocivas.
  it('a meta nunca passa de 100%', () => {
    const perfeitos = limpos(MIN_DAYS_FOR_GOAL + 2, 1);

    const meta = buildGoal(perfeitos, limpos(2, 20));

    expect(meta?.target).toBeLessThanOrEqual(1);
    expect(meta?.met).toBe(true);
  });

  it('respeita o piso quando o histórico é ruim', () => {
    const ruins = Array.from({ length: MIN_DAYS_FOR_GOAL + 1 }, (_, i) =>
      dia({ day: `2026-07-0${i + 1}`, delivered: 5, failed: 5 }),
    );

    const meta = buildGoal(ruins, limpos(1, 20));

    // Sem piso a meta seria 0,5 — cristalizaria um desempenho ruim como alvo.
    expect(meta?.target).toBe(GOAL_FLOOR);
  });

  // Propor meta com três dias de dados é fabricar exigência a partir de ruído.
  it('sem histórico suficiente não propõe meta', () => {
    expect(buildGoal(limpos(MIN_DAYS_FOR_GOAL - 1), limpos(1, 20))).toBeNull();
    expect(buildGoal([], limpos(1))).toBeNull();
  });
});

describe('restAdviceFor — a única leitura de jornada aponta para parar', () => {
  it('dia longo sugere descanso', () => {
    const aviso = restAdviceFor(dia({ activeMinutes: LONG_DAY_MINUTES + 30 }));

    expect(aviso).toMatchObject({ longDay: true });
  });

  it('dia curto não alarma', () => {
    expect(restAdviceFor(dia({ activeMinutes: 120 }))?.longDay).toBe(false);
  });

  it('sem atividade não há o que sugerir', () => {
    expect(restAdviceFor(dia())).toBeNull();
    expect(restAdviceFor(undefined)).toBeNull();
  });
});

describe('summarizeDriverPerformance', () => {
  it('consolida o período e conta só os dias trabalhados', () => {
    const rows = [
      ...limpos(3, 1),
      dia({ day: '2026-07-04' }), // folga
      dia({ day: '2026-07-05', delivered: 4, failed: 1, onTime: 3 }),
    ];

    const resumo = summarizeDriverPerformance(rows, limpos(6, 20), PERIODO.from, PERIODO.to);

    expect(resumo.delivered).toBe(19);
    expect(resumo.workedDays).toBe(4);
    expect(resumo.successRate).toBe(0.95);
  });

  it('pontualidade aparece como informação, mas fora da sequência', () => {
    const rows = [dia({ day: '2026-07-01', delivered: 10, onTime: 4 })];

    const resumo = summarizeDriverPerformance(rows, [], PERIODO.from, PERIODO.to);

    expect(resumo.onTimeRate).toBe(0.4);
    // Atraso não custou a sequência.
    expect(resumo.streak.days).toBe(1);
  });

  // Nada no que sai daqui permite comparar um motorista com outro.
  it('o resultado não expõe nenhuma referência a outro motorista', () => {
    const resumo = summarizeDriverPerformance(limpos(3), limpos(6, 20), PERIODO.from, PERIODO.to);

    const chaves = JSON.stringify(resumo).toLowerCase();
    expect(chaves).not.toContain('rank');
    expect(chaves).not.toContain('position');
    expect(chaves).not.toContain('average'); // média da frota
    expect(chaves).not.toContain('peer');
  });

  it('período vazio não inventa números', () => {
    const resumo = summarizeDriverPerformance([], [], PERIODO.from, PERIODO.to);

    expect(resumo).toMatchObject({
      delivered: 0,
      workedDays: 0,
      successRate: null,
      onTimeRate: null,
      goal: null,
      restAdvice: null,
    });
    expect(resumo.streak.days).toBe(0);
  });
});
