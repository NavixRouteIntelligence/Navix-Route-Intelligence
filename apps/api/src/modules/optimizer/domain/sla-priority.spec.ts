import { priorityWeight } from './optimization-stop';
import { MAX_SLA_BOOST, slaPriorityWeight } from './sla-priority';

describe('slaPriorityWeight', () => {
  it('sem janela: devolve o peso base (retrocompatível)', () => {
    expect(slaPriorityWeight('normal', null)).toBe(priorityWeight('normal'));
    expect(slaPriorityWeight('urgent', null)).toBe(priorityWeight('urgent'));
  });

  it('prazo vencido/vencendo: aplica o boost máximo', () => {
    expect(slaPriorityWeight('low', 0)).toBe(priorityWeight('low') + MAX_SLA_BOOST);
    expect(slaPriorityWeight('low', -30)).toBe(priorityWeight('low') + MAX_SLA_BOOST);
  });

  it('fora do horizonte de urgência: sem boost', () => {
    expect(slaPriorityWeight('normal', 300, 120)).toBe(priorityWeight('normal'));
  });

  it('dentro do horizonte: boost cresce conforme aperta o prazo', () => {
    const meio = slaPriorityWeight('normal', 60, 120); // proximidade 0.5
    const perto = slaPriorityWeight('normal', 12, 120); // proximidade 0.9
    expect(meio).toBeCloseTo(priorityWeight('normal') + 0.5 * MAX_SLA_BOOST);
    expect(perto).toBeGreaterThan(meio);
  });

  it('uma entrega comum com prazo apertado supera uma urgente folgada', () => {
    const normalApertada = slaPriorityWeight('normal', 5, 120);
    const urgenteFolgada = slaPriorityWeight('urgent', 300, 120);
    expect(normalApertada).toBeGreaterThan(urgenteFolgada);
  });
});
