import {
  BUCKET_ALL,
  bucketsFor,
  buildCellFeatures,
  dayPart,
  hourOfWeek,
  MIN_SAMPLE,
  resolveFeature,
  type ServiceTimeSample,
} from './cell-features';

const CELULA = '38.722,-9.139';

/** Terça-feira, 2026-07-28. */
const tercaAs = (hora: number): Date => new Date(2026, 6, 28, hora, 0);
/** Domingo, 2026-08-02. */
const domingoAs = (hora: number): Date => new Date(2026, 7, 2, hora, 0);

const amostra = (minutes: number, at: Date): ServiceTimeSample => ({ minutes, at });

describe('baldes temporais', () => {
  it('vão do mais específico ao mais geral', () => {
    expect(bucketsFor(tercaAs(9))).toEqual(['hw:57', 'dp:util:manha', BUCKET_ALL]);
  });

  // Terça 9h e domingo 9h não se parecem: separar dia útil de fim de semana é o
  // mínimo para o balde intermediário dizer alguma coisa.
  it('separam dia útil de fim de semana', () => {
    expect(bucketsFor(domingoAs(9))[1]).toBe('dp:fds:manha');
    expect(bucketsFor(tercaAs(9))[1]).toBe('dp:util:manha');
  });

  it('usam os mesmos períodos da heurística de trânsito', () => {
    expect(dayPart(3)).toBe('madrugada');
    expect(dayPart(9)).toBe('manha');
    expect(dayPart(15)).toBe('tarde');
    expect(dayPart(21)).toBe('noite');
  });

  it('hora da semana cobre 0..167', () => {
    expect(hourOfWeek(domingoAs(0))).toBe(0);
    expect(hourOfWeek(new Date(2026, 7, 1, 23))).toBe(6 * 24 + 23);
  });
});

describe('buildCellFeatures', () => {
  it('materializa os três níveis quando há amostra', () => {
    const samples = [
      amostra(5, tercaAs(9)),
      amostra(7, tercaAs(9)),
      amostra(9, tercaAs(9)),
    ];

    const features = buildCellFeatures(CELULA, samples);
    const baldes = features.map((f) => f.bucket).sort();

    expect(baldes).toEqual([BUCKET_ALL, 'dp:util:manha', 'hw:57']);
    expect(features.every((f) => f.serviceMinutesP50 === 7)).toBe(true);
  });

  // Materializar um balde que a leitura vai ignorar só ocuparia espaço e
  // enganaria quem inspecionasse a tabela.
  it('descarta balde abaixo da amostra mínima', () => {
    const features = buildCellFeatures(CELULA, [amostra(5, tercaAs(9)), amostra(7, tercaAs(9))]);

    expect(features).toEqual([]);
    expect(MIN_SAMPLE).toBe(3);
  });

  // Um atendimento que travou não pode arrastar o típico da rua inteira.
  it('usa mediana, resistente a um valor extremo', () => {
    const samples = [
      amostra(5, tercaAs(9)),
      amostra(6, tercaAs(9)),
      amostra(7, tercaAs(9)),
      amostra(120, tercaAs(9)),
    ];

    const global = buildCellFeatures(CELULA, samples).find((f) => f.bucket === BUCKET_ALL);

    expect(global?.serviceMinutesP50).toBe(6.5);
    expect(global?.samples).toBe(4);
  });

  it('o balde global acumula amostras de contextos diferentes', () => {
    const samples = [
      amostra(5, tercaAs(9)),
      amostra(6, domingoAs(15)),
      amostra(10, tercaAs(21)),
    ];

    const features = buildCellFeatures(CELULA, samples);

    // Nenhum contexto específico chegou a 3, mas o global sim.
    expect(features.map((f) => f.bucket)).toEqual([BUCKET_ALL]);
    expect(features[0].samples).toBe(3);
  });
});

describe('resolveFeature', () => {
  const feature = (bucket: string, p50: number, samples = MIN_SAMPLE) => ({
    cell: CELULA,
    bucket,
    samples,
    serviceMinutesP50: p50,
  });

  it('prefere o balde mais específico disponível', () => {
    const escolhida = resolveFeature(
      [feature(BUCKET_ALL, 10), feature('dp:util:manha', 8), feature('hw:57', 6)],
      tercaAs(9),
    );

    expect(escolhida).toMatchObject({ bucket: 'hw:57', serviceMinutesP50: 6, fallback: false });
  });

  // O caso do primeiro mês: ainda não há hora da semana, mas já há o período.
  it('cai para o período do dia quando falta a hora da semana', () => {
    const escolhida = resolveFeature(
      [feature(BUCKET_ALL, 10), feature('dp:util:manha', 8)],
      tercaAs(9),
    );

    expect(escolhida).toMatchObject({ bucket: 'dp:util:manha', fallback: false });
  });

  it('marca como fallback quando só resta o balde global', () => {
    const escolhida = resolveFeature([feature(BUCKET_ALL, 10)], tercaAs(9));

    expect(escolhida).toMatchObject({ bucket: BUCKET_ALL, fallback: true });
  });

  // Nulo é a resposta certa: quem chama tem um default melhor que um número
  // inventado (tipo de destino, ADR-0064).
  it('célula sem dado devolve null, não um padrão', () => {
    expect(resolveFeature([], tercaAs(9))).toBeNull();
  });

  it('não usa o balde de outro contexto temporal', () => {
    const escolhida = resolveFeature([feature('hw:57', 6)], domingoAs(9));

    expect(escolhida).toBeNull();
  });
});
