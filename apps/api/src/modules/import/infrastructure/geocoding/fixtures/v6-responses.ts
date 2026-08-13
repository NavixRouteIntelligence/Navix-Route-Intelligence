/**
 * Respostas da Forward Geocoding v6, com a forma que a Mapbox devolve.
 *
 * Escritas a partir da documentação do provedor e não do nosso parser — se
 * fossem derivadas dele, partilhariam qualquer engano de leitura e os testes
 * passariam à mesma.
 */

/** Morada completa, com número, no telhado do edifício. */
export const moradaExata = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'dXJuOm1ieGFkcjo...',
      geometry: { type: 'Point', coordinates: [-9.139337, 38.722252] },
      properties: {
        mapbox_id: 'dXJuOm1ieGFkcjo...',
        feature_type: 'address',
        name: 'Rua Augusta 100',
        place_formatted: 'Lisboa, Portugal',
        full_address: 'Rua Augusta 100, 1100-048 Lisboa, Portugal',
        coordinates: {
          longitude: -9.139337,
          latitude: 38.722252,
          accuracy: 'rooftop',
          routable_points: [{ name: 'default', latitude: 38.72226, longitude: -9.13934 }],
        },
        match_code: {
          address_number: 'matched',
          street: 'matched',
          postcode: 'matched',
          place: 'matched',
          region: 'matched',
          country: 'matched',
          confidence: 'exact',
        },
        context: {
          address: { name: 'Rua Augusta 100', address_number: '100', street_name: 'Rua Augusta' },
          street: { name: 'Rua Augusta' },
          postcode: { name: '1100-048' },
          place: { name: 'Lisboa' },
          region: { name: 'Lisboa', region_code: 'LI' },
          country: { name: 'Portugal', country_code: 'pt' },
        },
      },
    },
  ],
};

/** Rua sem número: a coordenada é o meio da rua, não uma porta. */
export const apenasRua = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-9.1401, 38.7215] },
      properties: {
        feature_type: 'street',
        name: 'Rua Augusta',
        coordinates: { longitude: -9.1401, latitude: 38.7215, accuracy: 'street' },
        context: {
          street: { name: 'Rua Augusta' },
          place: { name: 'Lisboa' },
          region: { name: 'Lisboa', region_code: 'LI' },
          country: { name: 'Portugal', country_code: 'pt' },
        },
      },
    },
  ],
};

/** Uma localidade inteira. O pino cairia na câmara municipal. */
export const apenasLocalidade = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-9.1393, 38.7223] },
      properties: {
        feature_type: 'place',
        name: 'Lisboa',
        coordinates: { longitude: -9.1393, latitude: 38.7223, accuracy: 'approximate' },
        context: {
          place: { name: 'Lisboa' },
          country: { name: 'Portugal', country_code: 'pt' },
        },
      },
    },
  ],
};

/** Morada que casou com dúvida — número inferido a partir da vizinhança. */
export const moradaDuvidosa = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.6333, -23.5505] },
      properties: {
        feature_type: 'address',
        name: 'Avenida Paulista 1000',
        coordinates: { longitude: -46.6333, latitude: -23.5505, accuracy: 'interpolated' },
        match_code: {
          address_number: 'inferred',
          street: 'matched',
          confidence: 'medium',
        },
        context: {
          address: {
            name: 'Avenida Paulista 1000',
            address_number: '1000',
            street_name: 'Avenida Paulista',
          },
          place: { name: 'São Paulo' },
          region: { name: 'São Paulo', region_code: 'SP' },
          country: { name: 'Brazil', country_code: 'br' },
        },
      },
    },
  ],
};

/** Morada interpolada mas com casamento firme: a rua e o número batem. */
export const moradaInterpoladaFirme = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-46.6333, -23.5505] },
      properties: {
        feature_type: 'address',
        name: 'Avenida Paulista 1578',
        coordinates: { longitude: -46.6333, latitude: -23.5505, accuracy: 'interpolated' },
        match_code: {
          address_number: 'matched',
          street: 'matched',
          confidence: 'high',
        },
        context: {
          address: {
            name: 'Avenida Paulista 1578',
            address_number: '1578',
            street_name: 'Avenida Paulista',
          },
          place: { name: 'São Paulo' },
          region: { name: 'São Paulo', region_code: 'SP' },
          country: { name: 'Brazil', country_code: 'br' },
        },
      },
    },
  ],
};

/** Nenhum resultado — morada que não existe. */
export const semResultados = { type: 'FeatureCollection', features: [] };

/** Resposta com feature mas sem coordenada utilizável. */
export const semCoordenada = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        feature_type: 'address',
        name: 'Rua Sem Ponto',
        match_code: { confidence: 'exact' },
      },
    },
  ],
};
