import {
  correctionFor,
  evaluateCorrections,
  MIN_IMPROVEMENT_PCT,
  MIN_TRAIN_SAMPLE,
  splitByTime,
  trainCorrections,
  type EtaTrainingSample,
} from './eta-correction';

const BALDES = ['hw:57', 'dp:util:manha', 'all'];

const amostra = (erro: number, buckets = BALDES): EtaTrainingSample => ({
  baselineErrorMinutes: erro,
  buckets,
});

/** N amostras com o mesmo erro e contexto. */
const repetir = (n: number, erro: number, buckets = BALDES): EtaTrainingSample[] =>
  Array.from({ length: n }, () => amostra(erro, buckets));

describe('trainCorrections', () => {
  it('aprende o resíduo típico de cada balde', () => {
    const corrections = trainCorrections(repetir(12, 10));

    expect(corrections).toHaveLength(3);
    expect(corrections.every((c) => c.correctionMinutes === 10)).toBe(true);
  });

  // Uma correção ajustada em três entregas é pior que cair no balde grosso.
  it('descarta balde abaixo da amostra mínima', () => {
    const corrections = trainCorrections(repetir(MIN_TRAIN_SAMPLE - 1, 10));

    expect(corrections).toEqual([]);
  });

  // O resíduo tem cauda longa: uma entrega travada duas horas não pode passar a
  // atrasar todas as previsões daquele contexto.
  it('mediana absorve o caso extremo', () => {
    const samples = [...repetir(11, 5), amostra(600)];

    const global = trainCorrections(samples).find((c) => c.bucket === 'all');

    expect(global?.correctionMinutes).toBe(5);
    expect(global?.samples).toBe(12);
  });

  it('o balde grosso acumula contextos que sozinhos não teriam amostra', () => {
    const samples = [
      ...repetir(6, 10, ['hw:57', 'dp:util:manha', 'all']),
      ...repetir(6, 10, ['hw:100', 'dp:util:tarde', 'all']),
    ];

    const baldes = trainCorrections(samples).map((c) => c.bucket);

    expect(baldes).toEqual(['all']);
  });
});

describe('correctionFor', () => {
  const corrections = [
    { bucket: 'all', samples: 50, correctionMinutes: 12 },
    { bucket: 'dp:util:manha', samples: 30, correctionMinutes: 8 },
    { bucket: 'hw:57', samples: 15, correctionMinutes: 4 },
  ];

  it('prefere o balde mais específico', () => {
    expect(correctionFor(corrections, BALDES)).toBe(4);
  });

  it('cai para o balde disponível seguinte', () => {
    expect(correctionFor(corrections, ['hw:999', 'dp:util:manha', 'all'])).toBe(8);
  });

  // Sem nada aprendido a heurística passa intacta — e não corrigida por zero
  // "por acaso", mas por decisão explícita.
  it('sem correção aprendida devolve zero', () => {
    expect(correctionFor([], BALDES)).toBe(0);
  });
});

describe('evaluateCorrections', () => {
  // O caso que justifica o modelo: viés sistemático.
  it('viés constante é removido quase por inteiro', () => {
    const corrections = trainCorrections(repetir(20, 10));

    const evaluation = evaluateCorrections(corrections, repetir(10, 10));

    expect(evaluation.baselineMae).toBe(10);
    expect(evaluation.modelMae).toBe(0);
    expect(evaluation.improvementPct).toBe(100);
    expect(evaluation.accepted).toBe(true);
  });

  // O caso em que o modelo não deve entrar: erro simétrico, sem viés a corrigir.
  it('erro que só oscila não é melhorado, e o modelo é recusado', () => {
    const treino = [...repetir(10, 10), ...repetir(10, -10)];
    const corrections = trainCorrections(treino);

    const evaluation = evaluateCorrections(corrections, [
      ...repetir(5, 10),
      ...repetir(5, -10),
    ]);

    expect(evaluation.baselineMae).toBe(10);
    expect(evaluation.modelMae).toBe(10);
    expect(evaluation.improvementPct).toBe(0);
    expect(evaluation.accepted).toBe(false);
  });

  it('modelo que piora tem melhora negativa e é recusado', () => {
    const corrections = [{ bucket: 'all', samples: 20, correctionMinutes: 30 }];

    const evaluation = evaluateCorrections(corrections, repetir(10, 5));

    expect(evaluation.modelMae).toBeGreaterThan(evaluation.baselineMae);
    expect(evaluation.improvementPct).toBeLessThan(0);
    expect(evaluation.accepted).toBe(false);
  });

  // Promover por ruído amostral trocaria uma heurística que se entende por um
  // número que ninguém sabe explicar.
  it('ganho abaixo da margem mínima não é aceito', () => {
    const corrections = [{ bucket: 'all', samples: 50, correctionMinutes: 0.3 }];

    const evaluation = evaluateCorrections(corrections, repetir(20, 10));

    expect(evaluation.improvementPct).toBeLessThan(MIN_IMPROVEMENT_PCT);
    expect(evaluation.accepted).toBe(false);
  });

  it('teste pequeno nunca é aceito, mesmo com ganho aparente', () => {
    const corrections = trainCorrections(repetir(20, 10));

    const evaluation = evaluateCorrections(corrections, repetir(3, 10));

    expect(evaluation.improvementPct).toBe(100);
    expect(evaluation.accepted).toBe(false);
  });

  it('sem amostra de teste não afirma ganho', () => {
    expect(evaluateCorrections([], [])).toMatchObject({
      testSamples: 0,
      baselineMae: 0,
      improvementPct: 0,
      accepted: false,
    });
  });
});

describe('splitByTime', () => {
  // Divisão aleatória deixaria o modelo ver o futuro do próprio teste.
  it('treina no passado e avalia no futuro', () => {
    const { train, test } = splitByTime([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

    expect(train).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(test).toEqual([8, 9, 10]);
  });

  it('lista vazia não quebra', () => {
    expect(splitByTime([])).toEqual({ train: [], test: [] });
  });
});
