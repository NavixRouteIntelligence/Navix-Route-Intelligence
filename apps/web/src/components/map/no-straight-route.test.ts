import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Nenhuma linha reta apresentada como percurso (ADR-0125).
 *
 * O `route-map` desenhava um `LineString` ligando as paradas, com 4 px e a cor
 * primária, sobre um mapa de ruas — sem nada a dizer que não era o caminho. A
 * regra passou a ser: entre pontos não se desenha nada até haver geometria real
 * da Directions API.
 *
 * Este teste guarda a regra para **todos** os mapas, não só para o que estava
 * errado: a próxima pessoa a acrescentar um mapa herda a proibição sem ter de
 * conhecer esta história.
 */
const DIR = __dirname;

function componentesDeMapa(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => join(DIR, f));
}

describe('mapas do web', () => {
  it('há mapas para verificar', () => {
    expect(componentesDeMapa().length).toBeGreaterThan(0);
  });

  it.each(componentesDeMapa())('%s não desenha linha entre paradas', (ficheiro) => {
    const fonte = readFileSync(ficheiro, 'utf8');
    // Só conta o código: a explicação do porquê menciona `LineString` de
    // propósito, e proibir a palavra no comentário apagaria a explicação.
    const codigo = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(codigo).not.toMatch(/LineString/);
    expect(codigo).not.toMatch(/type=["']line["']/);
  });

  // A geometria real, quando chegar, virá do provedor — não montada a partir
  // das coordenadas das paradas.
  it.each(componentesDeMapa())('%s não constrói geometria a partir das paradas', (ficheiro) => {
    const codigo = readFileSync(ficheiro, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

    expect(codigo).not.toMatch(/coordinates:\s*coords/);
  });
});
