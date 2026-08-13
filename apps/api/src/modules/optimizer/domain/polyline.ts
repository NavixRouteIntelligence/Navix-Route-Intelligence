/**
 * Descodificação do formato *polyline* da Google/Mapbox.
 *
 * ## Por que polyline e não GeoJSON
 *
 * A mesma linha em GeoJSON ocupa cerca de três vezes mais bytes — cada
 * coordenada vira dois números decimais com vírgulas e parênteses. Numa rota
 * urbana de trinta paradas isso é a diferença entre dezenas e centenas de
 * kilobytes, e quem paga a diferença é o telemóvel do motorista, muitas vezes
 * em dados móveis.
 *
 * ## Por que `polyline6` e não `polyline`
 *
 * O formato clássico tem cinco casas decimais: **~1,1 m** de resolução. Numa
 * rua estreita isso chega para o traçado saltar para o passeio do outro lado, e
 * a linha passa a atravessar o quarteirão. Com seis casas o erro cai para
 * ~11 cm. O pedido tem de declarar `geometries=polyline6`, e este descodificador
 * tem de usar a mesma precisão — usar 1e5 sobre dados de 1e6 devolve
 * coordenadas dez vezes menores, ou seja, uma rota algures no Golfo da Guiné,
 * sem erro nenhum pelo caminho.
 */

/** Coordenada no formato do GeoJSON: **longitude primeiro**. */
export type LineCoordinate = [longitude: number, latitude: number];

const PRECISION_6 = 1e6;

/**
 * Descodifica uma *polyline* codificada com seis casas decimais.
 *
 * Devolve `null` — e não uma linha parcial — quando a cadeia está corrompida.
 * Uma linha truncada a meio é pior do que nenhuma: desenha-se no mapa como um
 * percurso que acaba no meio da estrada, e nada indica que falta o resto.
 */
export function decodePolyline6(encoded: string): LineCoordinate[] | null {
  if (encoded.length === 0) return null;

  const coordinates: LineCoordinate[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const deltaLat = decodeSignedValue(encoded, index);
    if (deltaLat === null) return null;
    index = deltaLat.next;
    lat += deltaLat.value;

    const deltaLng = decodeSignedValue(encoded, index);
    if (deltaLng === null) return null;
    index = deltaLng.next;
    lng += deltaLng.value;

    const latitude = lat / PRECISION_6;
    const longitude = lng / PRECISION_6;
    // Uma cadeia corrompida decodifica sem erro e produz números fora do
    // planeta. Recusar aqui é o que impede que um traçado impossível chegue ao
    // mapa e faça a câmara enquadrar meio globo.
    if (!isFinite(latitude) || latitude < -90 || latitude > 90) return null;
    if (!isFinite(longitude) || longitude < -180 || longitude > 180) return null;

    coordinates.push([longitude, latitude]);
  }

  // Um ponto só não é uma linha.
  return coordinates.length >= 2 ? coordinates : null;
}

/**
 * Lê um valor com sinal a partir de [index]. `null` quando a cadeia acaba a
 * meio de um número — o caso que distingue «linha completa» de «linha cortada».
 */
function decodeSignedValue(
  encoded: string,
  index: number,
): { value: number; next: number } | null {
  let result = 0;
  let shift = 0;
  let byte: number;

  do {
    if (index >= encoded.length) return null;
    byte = encoded.charCodeAt(index++) - 63;
    if (byte < 0) return null;
    result |= (byte & 0x1f) << shift;
    shift += 5;
    // Cinco casas de seis dígitos cabem em 32 bits; mais do que isto é lixo, e
    // continuar a deslocar transbordaria em silêncio.
    if (shift > 35) return null;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    next: index,
  };
}

/**
 * Junta troços consecutivos numa linha só.
 *
 * O Mapbox Directions aceita no máximo 25 pontos por pedido, então uma rota
 * longa é pedida aos bocados. O último ponto de um troço é o primeiro do
 * seguinte — repeti-lo criaria um vértice duplicado, inofensivo no desenho mas
 * suficiente para que a contagem de pontos deixe de bater com a realidade.
 */
export function joinSegments(segments: LineCoordinate[][]): LineCoordinate[] {
  const linha: LineCoordinate[] = [];
  for (const segmento of segments) {
    if (segmento.length === 0) continue;
    const anterior = linha[linha.length - 1];
    const primeiro = segmento[0];
    const repetido =
      anterior !== undefined && anterior[0] === primeiro[0] && anterior[1] === primeiro[1];
    linha.push(...(repetido ? segmento.slice(1) : segmento));
  }
  return linha;
}
