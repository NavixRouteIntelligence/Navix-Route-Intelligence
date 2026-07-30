import { BUCKET_ALL, type CellFeature } from '../domain/cell-features';
import { locationCell } from '../domain/collective-insight';
import type { CellFeatureRepositoryPort } from '../domain/ports/cell-feature-repository.port';
import { CollectiveServiceTimeLookup } from './collective-service-time.lookup';

describe('CollectiveServiceTimeLookup (ADR-0065, materializado na ADR-0089)', () => {
  const A = { latitude: 38.7, longitude: -9.1 };
  const B = { latitude: 41.15, longitude: -8.61 };

  /** Terça-feira 09h. */
  const terca9h = new Date(2026, 6, 28, 9, 0);

  function feature(
    ponto: { latitude: number; longitude: number },
    bucket: string,
    p50: number,
  ): CellFeature {
    return {
      cell: locationCell(ponto.latitude, ponto.longitude),
      bucket,
      samples: 3,
      serviceMinutesP50: p50,
    };
  }

  function build(features: CellFeature[]) {
    const findByCells = jest.fn().mockResolvedValue(features);
    const repo: CellFeatureRepositoryPort = {
      samplesForCell: jest.fn(),
      replaceCell: jest.fn(),
      findByCells,
    };
    return { lookup: new CollectiveServiceTimeLookup(repo), findByCells };
  }

  it('devolve a mediana materializada da célula', async () => {
    const { lookup } = build([feature(A, BUCKET_ALL, 10)]);

    expect(await lookup.typicalServiceMinutes('t1', [A], terca9h)).toEqual([10]);
  });

  // Cascata (ADR-0089): o balde do contexto vence o global.
  it('prefere o contexto temporal ao balde global', async () => {
    const { lookup } = build([
      feature(A, BUCKET_ALL, 10),
      feature(A, 'dp:util:manha', 6),
      feature(A, 'hw:57', 4),
    ]);

    expect(await lookup.typicalServiceMinutes('t1', [A], terca9h)).toEqual([4]);
  });

  it('cai para o balde global quando o contexto ainda não tem amostra', async () => {
    const { lookup } = build([feature(A, BUCKET_ALL, 10)]);

    // Domingo às 21h: nenhum balde específico materializado.
    const domingo21h = new Date(2026, 7, 2, 21, 0);
    expect(await lookup.typicalServiceMinutes('t1', [A], domingo21h)).toEqual([10]);
  });

  it('célula sem feature devolve null, preservando a ordem dos pontos', async () => {
    const { lookup } = build([feature(A, BUCKET_ALL, 5)]);

    expect(await lookup.typicalServiceMinutes('t1', [B, A], terca9h)).toEqual([null, 5]);
  });

  it('lista vazia não consulta o banco', async () => {
    const { lookup, findByCells } = build([]);

    expect(await lookup.typicalServiceMinutes('t1', [], terca9h)).toEqual([]);
    expect(findByCells).not.toHaveBeenCalled();
  });

  // A troca que a ADR-0089 comprou: uma consulta por lote, não uma agregação de
  // milhares de linhas por chamada — e sem repetir a célula duplicada.
  it('consulta as células distintas numa chamada só', async () => {
    const { lookup, findByCells } = build([feature(A, BUCKET_ALL, 5)]);

    await lookup.typicalServiceMinutes('t1', [A, A, B], terca9h);

    expect(findByCells).toHaveBeenCalledTimes(1);
    expect(findByCells).toHaveBeenCalledWith('t1', [
      locationCell(A.latitude, A.longitude),
      locationCell(B.latitude, B.longitude),
    ]);
  });
});
