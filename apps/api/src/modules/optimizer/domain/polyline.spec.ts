import { decodePolyline6, joinSegments, type LineCoordinate } from './polyline';

/**
 * Codificador de referência, só para os testes. Escrito a partir da definição
 * do formato e **não** do descodificador — se fosse o inverso dele, os dois
 * partilhariam qualquer engano e o teste passaria à mesma.
 */
function encodePolyline6(coordinates: LineCoordinate[]): string {
  let saida = '';
  let latAnterior = 0;
  let lngAnterior = 0;

  for (const [lng, lat] of coordinates) {
    const latE6 = Math.round(lat * 1e6);
    const lngE6 = Math.round(lng * 1e6);
    saida += encodeValue(latE6 - latAnterior) + encodeValue(lngE6 - lngAnterior);
    latAnterior = latE6;
    lngAnterior = lngE6;
  }
  return saida;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let saida = '';
  while (v >= 0x20) {
    saida += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return saida + String.fromCharCode(v + 63);
}

describe('decodePolyline6', () => {
  it('devolve as coordenadas na ordem, longitude primeiro', () => {
    const original: LineCoordinate[] = [
      [-9.139337, 38.722252],
      [-9.14211, 38.724001],
      [-9.145, 38.7255],
    ];

    expect(decodePolyline6(encodePolyline6(original))).toEqual(original);
  });

  it('mantém a precisão de seis casas', () => {
    // É o ponto do formato: com cinco casas o erro chega a ~1,1 m e a linha
    // salta para o passeio do outro lado da rua.
    const original: LineCoordinate[] = [
      [-9.139337, 38.722252],
      [-9.139338, 38.722253],
    ];

    const lido = decodePolyline6(encodePolyline6(original))!;

    expect(lido[1][0]).toBeCloseTo(-9.139338, 6);
    expect(lido[1][1]).toBeCloseTo(38.722253, 6);
  });

  it('lê corretamente uma linha que atravessa o meridiano e o equador', () => {
    // Valores negativos e mudanças de sinal são onde um deslocamento com sinal
    // mal feito se manifesta.
    const original: LineCoordinate[] = [
      [-0.001, -0.001],
      [0.001, 0.001],
      [-0.002, 0.002],
    ];

    expect(decodePolyline6(encodePolyline6(original))).toEqual(original);
  });

  it('cadeia vazia não é linha', () => {
    expect(decodePolyline6('')).toBeNull();
  });

  it('um ponto só não é linha', () => {
    expect(decodePolyline6(encodePolyline6([[-9.13, 38.72]]))).toBeNull();
  });

  it('cadeia cortada a meio devolve nulo, e não a parte que deu', () => {
    // Uma linha truncada desenha-se como um percurso que acaba no meio da
    // estrada, e nada no mapa indica que falta o resto.
    const completa = encodePolyline6([
      [-9.139337, 38.722252],
      [-9.14211, 38.724001],
      [-9.145, 38.7255],
    ]);

    expect(decodePolyline6(completa.slice(0, completa.length - 1))).toBeNull();
  });

  it('coordenada fora do planeta é recusada', () => {
    // É o que acontece se o traçado vier em `polyline` (5 casas) e for lido
    // como `polyline6`, ou ao contrário: os números decodificam sem erro
    // nenhum e ficam dez vezes maiores.
    const forcado = encodePolyline6([
      [-9.139337, 38.722252],
      [-9.14211, 38.724001],
    ]);
    // Multiplicar por dez o que já é grau: 387° de latitude não existe.
    const dezVezes = encodePolyline6([
      [-91.39337, 387.22252 - 360],
      [-91.4211, 387.24001 - 360],
    ]);

    expect(decodePolyline6(forcado)).not.toBeNull();
    // 27° é válido; o que se recusa é o que sai do intervalo.
    expect(decodePolyline6(dezVezes)).not.toBeNull();
    // Uma latitude explicitamente fora do intervalo:
    expect(
      decodePolyline6(
        encodePolyline6([
          [0, 0],
          [0, 91],
        ]),
      ),
    ).toBeNull();
  });

  it('lixo que não é polyline não vira linha nem estoura', () => {
    expect(() => decodePolyline6('não é uma polyline!!')).not.toThrow();
  });
});

describe('joinSegments', () => {
  it('cola troços removendo o ponto repetido da junção', () => {
    const a: LineCoordinate[] = [
      [-9.1, 38.7],
      [-9.2, 38.8],
    ];
    const b: LineCoordinate[] = [
      [-9.2, 38.8],
      [-9.3, 38.9],
    ];

    expect(joinSegments([a, b])).toEqual([
      [-9.1, 38.7],
      [-9.2, 38.8],
      [-9.3, 38.9],
    ]);
  });

  it('não remove um ponto que apenas se parece com a junção', () => {
    const a: LineCoordinate[] = [
      [-9.1, 38.7],
      [-9.2, 38.8],
    ];
    const b: LineCoordinate[] = [
      [-9.2, 38.9],
      [-9.3, 39.0],
    ];

    expect(joinSegments([a, b])).toHaveLength(4);
  });

  it('troço vazio no meio não impede a junção dos outros', () => {
    const a: LineCoordinate[] = [
      [-9.1, 38.7],
      [-9.2, 38.8],
    ];
    const b: LineCoordinate[] = [
      [-9.2, 38.8],
      [-9.3, 38.9],
    ];

    // O vazio é ignorado, e `b` continua a colar em `a` pelo ponto comum.
    expect(joinSegments([a, [], b])).toEqual([
      [-9.1, 38.7],
      [-9.2, 38.8],
      [-9.3, 38.9],
    ]);
  });

  it('sem troços, linha vazia', () => {
    expect(joinSegments([])).toEqual([]);
  });
});
