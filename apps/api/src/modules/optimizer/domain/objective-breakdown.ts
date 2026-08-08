import type { ObjectiveBreakdown, ObjectiveComponent } from '@navix/contracts';

import type { OptimizationWeights } from './ports/route-optimization-strategy.port';

/**
 * O que entrou na pontuação, e com que peso (ADR-0111).
 *
 * Só componentes com peso **maior que zero** aparecem: listar `duration: 0`
 * sugeriria que o tempo foi considerado e não pesou, quando na verdade ele não
 * entrou na conta. A distinção importa para quem compara dois planos e quer
 * saber por que os números diferem.
 */
export function describeObjective(
  weights: OptimizationWeights,
  hasTollData: boolean,
): ObjectiveBreakdown {
  const todos: [ObjectiveComponent, number | undefined][] = [
    ['distance', weights.distance],
    ['duration', weights.duration],
    // Peso de portagem sem dados não é componente: não há o que pesar, e
    // declará-lo faria parecer que a rota considerou portagem.
    ['toll', hasTollData ? weights.toll : 0],
    ['timeWindow', weights.timeWindow],
    ['priority', weights.priority],
    ['surcharge', weights.surcharge],
  ];

  const ativos = todos.filter((entrada): entrada is [ObjectiveComponent, number] => {
    const [, peso] = entrada;
    return typeof peso === 'number' && peso > 0;
  });

  return {
    components: ativos.map(([nome]) => nome),
    weights: Object.fromEntries(ativos),
    tollData: hasTollData ? 'configured' : 'absent',
  };
}
