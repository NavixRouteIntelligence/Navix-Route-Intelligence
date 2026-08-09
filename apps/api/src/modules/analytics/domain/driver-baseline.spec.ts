import type { DailyRawRow } from './daily-subject';
import {
  BASELINE_DAYS,
  MIN_SAMPLE,
  comparePersonalBaseline,
  median,
  medianAbsoluteDeviation,
} from './driver-baseline';

/** Dia trabalhado. `min` são os minutos de atividade; `null` = desconhecido. */
function dia(
  day: string,
  delivered: number,
  failed = 0,
  onTime = delivered,
  min: number | null = 300,
): DailyRawRow {
  const inicio = new Date(`${day}T08:00:00Z`);
  return {
    day,
    delivered,
    failed,
    onTime,
    firstActivityAt: min === null ? null : inicio,
    lastActivityAt: min === null ? null : new Date(inicio.getTime() + min * 60_000),
    plans: 0,
    savedKm: null,
    savedMinutes: null,
    vehicleTypes: [],
    projectedAt: new Date(`${day}T23:00:00Z`),
  };
}

/** Dia de folga: projetado, sem trabalho. */
function folga(day: string): DailyRawRow {
  return dia(day, 0, 0, 0, null);
}

describe('median / MAD', () => {
  it('mediana de amostra ímpar é o valor central', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('mediana de amostra par é a média dos dois centrais', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('amostra vazia não tem mediana', () => {
    expect(median([])).toBeNull();
    expect(medianAbsoluteDeviation([])).toBeNull();
  });

  // A mediana é o que impede um dia excecional de deslocar a referência.
  it('um outlier não desloca a mediana', () => {
    expect(median([10, 10, 10, 10, 90])).toBe(10);
  });
});

describe('comparePersonalBaseline', () => {
  const historico = ['01', '02', '03', '04', '05'].map((d) => dia(`2026-08-${d}`, 10));

  it('compara o último dia trabalhado com a mediana dos anteriores', () => {
    const r = comparePersonalBaseline([...historico, dia('2026-08-06', 20)]);

    expect(r.day).toBe('2026-08-06');
    expect(r.delivered.current).toBe(20);
    expect(r.delivered.baseline).toBe(10);
    expect(r.delivered.trend).toBe('improved');
    expect(r.delivered.sample).toBe(5);
  });

  it('a ordem das linhas não altera o resultado', () => {
    const baralhado = [dia('2026-08-06', 20), ...[...historico].reverse()];

    expect(comparePersonalBaseline(baralhado)).toEqual(
      comparePersonalBaseline([...historico, dia('2026-08-06', 20)]),
    );
  });

  it('a mesma entrada dá sempre a mesma saída', () => {
    const entrada = [...historico, dia('2026-08-06', 13)];

    expect(comparePersonalBaseline(entrada)).toEqual(comparePersonalBaseline(entrada));
  });

  it('usa no máximo os sete dias trabalhados anteriores', () => {
    const muitos = Array.from({ length: 20 }, (_, i) =>
      dia(`2026-07-${String(i + 1).padStart(2, '0')}`, 10),
    );

    const r = comparePersonalBaseline([...muitos, dia('2026-08-01', 10)]);

    expect(r.delivered.sample).toBe(BASELINE_DAYS);
  });

  describe('amostra pequena', () => {
    it('sem dias suficientes, é "a construir histórico" — não "estável"', () => {
      const r = comparePersonalBaseline([dia('2026-08-01', 10), dia('2026-08-02', 10)]);

      expect(r.delivered.trend).toBe('building-history');
      expect(r.delivered.baseline).toBeNull();
      expect(r.delivered.sample).toBe(1);
    });

    it('sem nenhum dia trabalhado, não há dia a comparar', () => {
      const r = comparePersonalBaseline([folga('2026-08-01'), folga('2026-08-02')]);

      expect(r.day).toBeNull();
      expect(r.delivered.trend).toBe('building-history');
    });

    it(`${MIN_SAMPLE} dias anteriores já bastam`, () => {
      const r = comparePersonalBaseline([
        dia('2026-08-01', 10),
        dia('2026-08-02', 10),
        dia('2026-08-03', 10),
        dia('2026-08-04', 20),
      ]);

      expect(r.delivered.trend).toBe('improved');
    });
  });

  describe('descanso', () => {
    // O critério de aceite: descansar não pode quebrar progresso nem reduzir
    // nada. Dias de folga são ignorados, e a comparação é idêntica sem eles.
    it('dias de folga no meio não alteram a comparação', () => {
      const semFolga = [...historico, dia('2026-08-06', 12)];
      const comFolga = [
        ...historico.slice(0, 2),
        folga('2026-08-10'),
        folga('2026-08-11'),
        ...historico.slice(2),
        folga('2026-08-12'),
        dia('2026-08-06', 12),
      ];

      expect(comparePersonalBaseline(comFolga)).toEqual(comparePersonalBaseline(semFolga));
    });

    it('uma semana de folga não torna o regresso "merece atenção"', () => {
      const folgas = ['10', '11', '12', '13', '14', '15', '16'].map((d) => folga(`2026-08-${d}`));

      const r = comparePersonalBaseline([...historico, ...folgas, dia('2026-08-17', 10)]);

      expect(r.delivered.trend).toBe('stable');
    });
  });

  describe('denominador válido', () => {
    it('sem finalizadas, a taxa de sucesso do dia não existe', () => {
      const r = comparePersonalBaseline([...historico, dia('2026-08-06', 0, 0, 0)]);

      // Dia sem trabalho nem entra: o último trabalhado continua a ser o 05.
      expect(r.day).toBe('2026-08-05');
    });

    it('dias sem denominador saem da amostra em vez de contar como zero', () => {
      const semEntregues = [
        dia('2026-08-01', 0, 3, 0),
        dia('2026-08-02', 0, 3, 0),
        dia('2026-08-03', 0, 3, 0),
        dia('2026-08-04', 10, 0, 8),
      ];

      const r = comparePersonalBaseline(semEntregues);

      // `onTimeRate` precisa de entregues no denominador; nenhum dia anterior
      // teve, portanto não há referência — e não uma referência de 0%.
      expect(r.onTimeRate.sample).toBe(0);
      expect(r.onTimeRate.trend).toBe('building-history');
    });

    it('minutos desconhecidos não entram na mediana de atividade', () => {
      const r = comparePersonalBaseline([
        dia('2026-08-01', 10, 0, 10, null),
        dia('2026-08-02', 10, 0, 10, null),
        dia('2026-08-03', 10, 0, 10, 300),
        dia('2026-08-04', 10, 0, 10, 300),
      ]);

      expect(r.activeMinutes.sample).toBe(1);
      expect(r.activeMinutes.trend).toBe('building-history');
    });
  });

  describe('outliers e limiares', () => {
    it('variação relativa grande mas absoluta pequena é estável', () => {
      const poucas = ['01', '02', '03', '04'].map((d) => dia(`2026-08-${d}`, 2));

      const r = comparePersonalBaseline([...poucas, dia('2026-08-05', 3)]);

      expect(r.delivered.trend).toBe('stable'); // +50%, mas só +1
    });

    // Quem varia muito não deve ser acusado de anormal por mais um dia dentro
    // da própria variação: é o papel do MAD.
    it('quem varia muito não recebe atenção por variar de novo', () => {
      const irregular = [
        dia('2026-08-01', 4),
        dia('2026-08-02', 20),
        dia('2026-08-03', 6),
        dia('2026-08-04', 18),
        dia('2026-08-05', 12),
      ];

      // Mediana 12, MAD 6: um dia de 7 fica **dentro** da variação habitual.
      const r = comparePersonalBaseline([...irregular, dia('2026-08-06', 7)]);

      expect(r.delivered.trend).toBe('stable');
    });

    it('quem é regular recebe o sinal de uma queda real', () => {
      const regular = ['01', '02', '03', '04', '05'].map((d) => dia(`2026-08-${d}`, 12));

      const r = comparePersonalBaseline([...regular, dia('2026-08-06', 4)]);

      expect(r.delivered.trend).toBe('attention');
    });
  });

  describe('pontualidade informa, não cobra', () => {
    it('uma queda de pontualidade nunca vira "merece atenção"', () => {
      const pontual = ['01', '02', '03', '04', '05'].map((d) => dia(`2026-08-${d}`, 10, 0, 10));

      const r = comparePersonalBaseline([...pontual, dia('2026-08-06', 10, 0, 2)]);

      expect(r.onTimeRate.current).toBeCloseTo(0.2);
      expect(r.onTimeRate.baseline).toBe(1);
      expect(r.onTimeRate.trend).toBe('stable');
      expect(r.onTimeRate.informative).toBe(true);
    });

    it('uma subida de pontualidade pode ser reconhecida', () => {
      const irregular = ['01', '02', '03', '04', '05'].map((d) => dia(`2026-08-${d}`, 10, 0, 5));

      const r = comparePersonalBaseline([...irregular, dia('2026-08-06', 10, 0, 10)]);

      expect(r.onTimeRate.trend).toBe('improved');
    });
  });

  describe('tempo ativo tem a direção invertida', () => {
    // Classificar um dia mais longo como "melhorou" seria incentivar jornada.
    it('dia bem mais longo do que o habitual merece atenção', () => {
      const normais = ['01', '02', '03', '04', '05'].map((d) =>
        dia(`2026-08-${d}`, 10, 0, 10, 300),
      );

      const r = comparePersonalBaseline([...normais, dia('2026-08-06', 10, 0, 10, 600)]);

      expect(r.activeMinutes.trend).toBe('attention');
    });

    // E um dia curto não é conquista: descanso não é desempenho.
    it('dia mais curto não é "melhorou"', () => {
      const longos = ['01', '02', '03', '04', '05'].map((d) => dia(`2026-08-${d}`, 10, 0, 10, 600));

      const r = comparePersonalBaseline([...longos, dia('2026-08-06', 10, 0, 10, 200)]);

      expect(r.activeMinutes.trend).toBe('stable');
    });
  });
});
