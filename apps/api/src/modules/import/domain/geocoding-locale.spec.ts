import { localeForTimeZone } from './geocoding-locale';

describe('localeForTimeZone', () => {
  it.each(['Europe/Lisbon', 'Atlantic/Azores', 'Atlantic/Madeira'])(
    '%s é Portugal',
    (zona) => {
      expect(localeForTimeZone(zona)).toEqual({ country: 'pt', language: 'pt' });
    },
  );

  it.each(['America/Sao_Paulo', 'America/Manaus', 'America/Noronha', 'America/Rio_Branco'])(
    '%s é Brasil',
    (zona) => {
      expect(localeForTimeZone(zona)).toEqual({ country: 'br', language: 'pt' });
    },
  );

  it('UTC não vira Brasil', () => {
    // `UTC` é o valor por omissão do tenant e não diz nada. Assumir o mercado
    // maior faria uma morada portuguesa resolver no Brasil, com coordenadas
    // plausíveis e um pino a milhares de quilómetros.
    expect(localeForTimeZone('UTC').country).toBeUndefined();
  });

  it('fuso ausente ou vazio também não vira país nenhum', () => {
    expect(localeForTimeZone(null).country).toBeUndefined();
    expect(localeForTimeZone(undefined).country).toBeUndefined();
    expect(localeForTimeZone('   ').country).toBeUndefined();
  });

  it('outros fusos das Américas não são Brasil', () => {
    // `America/` cobre o continente inteiro: deduzir o país do prefixo poria
    // moradas de Bogotá e de Buenos Aires a serem procuradas no Brasil.
    expect(localeForTimeZone('America/Bogota').country).toBeUndefined();
    expect(localeForTimeZone('America/Argentina/Buenos_Aires').country).toBeUndefined();
    expect(localeForTimeZone('America/New_York').country).toBeUndefined();
  });

  it('o idioma é sempre português', () => {
    // Os dois mercados falam português, e os rótulos devolvidos alimentam a
    // morada que o motorista lê.
    for (const zona of ['Europe/Lisbon', 'America/Sao_Paulo', 'UTC', 'Asia/Tokyo']) {
      expect(localeForTimeZone(zona).language).toBe('pt');
    }
  });
});
