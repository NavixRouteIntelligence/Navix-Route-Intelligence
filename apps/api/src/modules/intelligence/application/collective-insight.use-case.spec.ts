import { ValidationError } from '../../../shared/kernel/domain-error';
import { InMemoryCollectiveInsights } from '../infrastructure/in-memory-collective-insights';
import { GetCollectiveInsightUseCase } from './get-collective-insight.use-case';
import { RecordObservationUseCase } from './record-observation.use-case';

function build() {
  const store = new InMemoryCollectiveInsights();
  return {
    store,
    record: new RecordObservationUseCase(store),
    insight: new GetCollectiveInsightUseCase(store),
  };
}

const POINT = { latitude: -23.55, longitude: -46.63 };

describe('Collective intelligence use cases', () => {
  it('registra observações e as agrega na mesma célula', async () => {
    const { record, insight } = build();
    for (const difficulty of ['hard', 'hard', 'moderate'] as const) {
      await record.execute({ tenantId: 't1', driverId: 'd1', kind: 'parking', parkingDifficulty: difficulty, ...POINT });
    }
    const view = await insight.execute({ tenantId: 't1', ...POINT });
    expect(view.sampleSize).toBe(3);
    expect(view.parking?.difficulty).toBe('hard');
  });

  it('devolve a célula no resultado do registro', async () => {
    const { record } = build();
    const res = await record.execute({ tenantId: 't1', driverId: 'd1', kind: 'access', accessTip: 'Doca 3', ...POINT });
    expect(res.cell).toBe('-23.550,-46.630');
    expect(res.id).toEqual(expect.any(String));
  });

  it('isola por tenant (RLS na camada de dados; aqui, por filtro)', async () => {
    const { record, insight } = build();
    await record.execute({ tenantId: 't1', driverId: 'd1', kind: 'service_time', serviceMinutes: 5, ...POINT });
    const other = await insight.execute({ tenantId: 't2', ...POINT });
    expect(other.sampleSize).toBe(0);
  });

  it('rejeita parking sem dificuldade', async () => {
    const { record } = build();
    await expect(
      record.execute({ tenantId: 't1', driverId: 'd1', kind: 'parking', ...POINT }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita access sem dica', async () => {
    const { record } = build();
    await expect(
      record.execute({ tenantId: 't1', driverId: 'd1', kind: 'access', accessTip: '  ', ...POINT }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejeita service_time inválido', async () => {
    const { record } = build();
    await expect(
      record.execute({ tenantId: 't1', driverId: 'd1', kind: 'service_time', serviceMinutes: -1, ...POINT }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
