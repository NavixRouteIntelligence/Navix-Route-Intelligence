import { randomUUID } from 'node:crypto';

import { isInRollout, rolloutBucket } from './kaizen-rollout';

const AMOSTRA = Array.from({ length: 3000 }, () => randomUUID());

describe('rolloutBucket', () => {
  it('é determinístico: o mesmo id cai sempre no mesmo balde', () => {
    const id = randomUUID();

    expect(rolloutBucket(id)).toBe(rolloutBucket(id));
  });

  it('fica no intervalo de 0 a 99', () => {
    for (const id of AMOSTRA.slice(0, 200)) {
      const b = rolloutBucket(id);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  // Uma distribuição enviesada faria «10%» significar 2% ou 30% na prática.
  it('distribui de forma razoavelmente uniforme', () => {
    const contagem = new Array<number>(10).fill(0);
    for (const id of AMOSTRA) contagem[Math.floor(rolloutBucket(id) / 10)] += 1;

    const esperado = AMOSTRA.length / 10;
    for (const n of contagem) {
      expect(n).toBeGreaterThan(esperado * 0.6);
      expect(n).toBeLessThan(esperado * 1.4);
    }
  });
});

describe('isInRollout', () => {
  it('0% fecha para todos', () => {
    expect(AMOSTRA.filter((id) => isInRollout(id, 0))).toHaveLength(0);
  });

  // 100 é o único valor que dispensa o cálculo: um rollout completo não deve
  // depender de nenhuma propriedade do hash.
  it('100% abre para todos', () => {
    expect(AMOSTRA.every((id) => isInRollout(id, 100))).toBe(true);
  });

  it('uma percentagem intermédia seleciona perto do pedido', () => {
    const dentro = AMOSTRA.filter((id) => isInRollout(id, 25)).length;

    expect(dentro / AMOSTRA.length).toBeGreaterThan(0.2);
    expect(dentro / AMOSTRA.length).toBeLessThan(0.3);
  });

  // O ponto do hash: subir a percentagem só acrescenta pessoas, nunca troca as
  // que já entraram. Quem viu o resumo ontem não o perde hoje.
  it('subir a percentagem é monótono — ninguém sai', () => {
    const em10 = new Set(AMOSTRA.filter((id) => isInRollout(id, 10)));
    const em50 = new Set(AMOSTRA.filter((id) => isInRollout(id, 50)));

    for (const id of em10) expect(em50.has(id)).toBe(true);
  });

  it('baixar a percentagem só remove — não convida ninguém', () => {
    const em50 = new Set(AMOSTRA.filter((id) => isInRollout(id, 50)));
    const em10 = AMOSTRA.filter((id) => isInRollout(id, 10));

    for (const id of em10) expect(em50.has(id)).toBe(true);
  });

  // Um sorteio por pedido daria a mesma pessoa a funcionalidade num pedido e
  // não no seguinte — parece avaria, não piloto.
  it('a resposta não muda entre chamadas', () => {
    const id = randomUUID();
    const respostas = Array.from({ length: 50 }, () => isInRollout(id, 37));

    expect(new Set(respostas).size).toBe(1);
  });
});
