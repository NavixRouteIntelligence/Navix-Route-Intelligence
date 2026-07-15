import { ValidationError } from '../../../shared/kernel/domain-error';
import { HeuristicLoadPlanner } from '../infrastructure/heuristic-load-planner';
import { PlanLoadUseCase } from './plan-load.use-case';

function build() {
  return new PlanLoadUseCase(new HeuristicLoadPlanner());
}

const base = {
  tenantId: 't1',
  items: [
    { id: 'a', sequence: 1, weightKg: 10 },
    { id: 'b', sequence: 2, weightKg: 20 },
  ],
};

describe('PlanLoadUseCase', () => {
  it('produz um plano de carga LIFO', () => {
    const plan = build().execute(base);
    expect(plan.placements.map((p) => p.id)).toEqual(['b', 'a']);
    expect(plan.totalWeightKg).toBe(30);
  });

  it('rejeita plano sem itens', () => {
    expect(() => build().execute({ tenantId: 't1', items: [] })).toThrow(ValidationError);
  });

  it('rejeita itens com id duplicado', () => {
    expect(() =>
      build().execute({
        tenantId: 't1',
        items: [
          { id: 'a', sequence: 1 },
          { id: 'a', sequence: 2 },
        ],
      }),
    ).toThrow(ValidationError);
  });

  it('rejeita capacidade não positiva', () => {
    expect(() => build().execute({ ...base, capacityKg: 0 })).toThrow(ValidationError);
  });
});
