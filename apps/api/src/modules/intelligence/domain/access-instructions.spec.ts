import { classifyAccessNotes } from './access-instructions';

describe('classifyAccessNotes', () => {
  it('sem observações: lista vazia', () => {
    expect(classifyAccessNotes(undefined)).toEqual([]);
    expect(classifyAccessNotes('   ')).toEqual([]);
  });

  it('classifica cada segmento por palavra-chave', () => {
    const out = classifyAccessNotes(
      'Entrar pela doca dos fundos; interfone 12; código do portão 4589; deixar na portaria',
    );
    expect(out.map((i) => i.kind)).toEqual(['dock', 'intercom', 'gate_code', 'reception']);
  });

  it('texto sem palavra-chave vira nota genérica', () => {
    const out = classifyAccessNotes('Cuidado com o cão');
    expect(out).toEqual([{ kind: 'note', text: 'Cuidado com o cão' }]);
  });
});
