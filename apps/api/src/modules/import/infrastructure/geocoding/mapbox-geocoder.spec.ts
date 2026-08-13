import { Logger } from '@nestjs/common';

import type { AppConfigService } from '../../../../shared/config/app-config.service';
import { GeocodingMetrics } from './geocoding-metrics';
import {
  apenasLocalidade,
  apenasRua,
  moradaDuvidosa,
  moradaExata,
  moradaInterpoladaFirme,
  semCoordenada,
  semResultados,
} from './fixtures/v6-responses';
import { MapboxGeocoder, sanitize } from './mapbox-geocoder';

function configWith(mapboxToken?: string): AppConfigService {
  return { mapboxToken } as AppConfigService;
}

function metricsStub() {
  return { observe: jest.fn(), observeHttp: jest.fn() } as unknown as GeocodingMetrics;
}

function respondeCom(body: unknown, ok = true, status = 200) {
  const urls: string[] = [];
  global.fetch = jest.fn(async (url: unknown) => {
    urls.push(String(url));
    return { ok, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return urls;
}

const MORADA = 'Rua Augusta 100, Lisboa';

describe('MapboxGeocoder (v6)', () => {
  const originalFetch = global.fetch;
  let avisos: string[];

  beforeEach(() => {
    avisos = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((msg: unknown) => {
      avisos.push(String(msg));
    });
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('endpoint e parâmetros', () => {
    it('chama o forward geocoding v6', async () => {
      const urls = respondeCom(moradaExata);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(urls[0]).toContain('/search/geocode/v6/forward');
      expect(urls[0]).not.toContain('geocoding/v5');
    });

    it('envia país e idioma quando o tenant os define', async () => {
      const urls = respondeCom(moradaExata);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA, {
        country: 'pt',
        language: 'pt',
      });

      expect(urls[0]).toContain('country=pt');
      expect(urls[0]).toContain('language=pt');
    });

    it('sem país, não filtra por país nenhum', async () => {
      // Filtrar por um palpite devolveria a morada mais parecida no país
      // errado, com coordenadas plausíveis e um pino a milhares de km.
      const urls = respondeCom(moradaExata);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(urls[0]).not.toContain('country=');
    });

    it('não pede sugestões parciais', async () => {
      const urls = respondeCom(moradaExata);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(urls[0]).toContain('autocomplete=false');
    });
  });

  describe('leitura da resposta v6', () => {
    it('lê coordenadas e componentes de uma morada exata', async () => {
      respondeCom(moradaExata);

      const r = await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(r).toMatchObject({
        latitude: 38.722252,
        longitude: -9.139337,
        street: 'Rua Augusta',
        number: '100',
        city: 'Lisboa',
        postalCode: '1100-048',
        country: 'PT',
        confidence: 'exact',
        accuracy: 'rooftop',
        needsReview: false,
      });
    });

    it('o código de região vem sem o prefixo do país', async () => {
      // A v5 devolvia `BR-SP` em `short_code` e obrigava a cortar o prefixo à
      // mão; a v6 já dá `SP` em `region_code`.
      respondeCom(moradaDuvidosa);

      const r = await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(r?.state).toBe('SP');
    });

    it('feature sem coordenada não vira resultado', async () => {
      respondeCom(semCoordenada);

      expect(await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA)).toBeNull();
    });
  });

  describe('endereços sem resultado', () => {
    it('não recebem coordenadas inventadas', async () => {
      // Critério de aceite: sem resultado continua inválido.
      respondeCom(semResultados);

      expect(await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA)).toBeNull();
    });

    it('morada vazia nem chega a ser pedida', async () => {
      const urls = respondeCom(moradaExata);

      expect(await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode('   ')).toBeNull();
      expect(urls).toHaveLength(0);
    });

    it('sem token não há geocodificação nem pedido', async () => {
      const urls = respondeCom(moradaExata);

      expect(await new MapboxGeocoder(configWith(undefined), metricsStub()).geocode(MORADA)).toBeNull();
      expect(urls).toHaveLength(0);
    });
  });

  describe('resultados que não viram parada sozinhos', () => {
    it('uma rua sem número vai para revisão', async () => {
      respondeCom(apenasRua);

      const r = await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(r?.needsReview).toBe(true);
      expect(r?.reviewReason).toBeTruthy();
    });

    it('uma localidade inteira vai para revisão', async () => {
      // O pino cairia na câmara municipal e a rota seria otimizada à volta
      // dele.
      respondeCom(apenasLocalidade);

      expect(
        (await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA))?.needsReview,
      ).toBe(true);
    });

    it('confiança média vai para revisão', async () => {
      respondeCom(moradaDuvidosa);

      expect(
        (await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA))?.needsReview,
      ).toBe(true);
    });

    it('uma morada interpolada com casamento firme é aceite', async () => {
      // Interpolado não é o telhado, mas é a rua certa e o quarteirão certo —
      // chega para conduzir até lá. Recusá-lo mandaria metade das moradas
      // brasileiras para revisão manual.
      respondeCom(moradaInterpoladaFirme);

      const r = await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(r?.needsReview).toBe(false);
      expect(r?.reviewReason).toBeNull();
    });
  });

  describe('o que não aparece nos registos', () => {
    it('a morada não é registada quando não há resultados', async () => {
      // A versão v5 registava `Mapbox sem resultados para: ${address}` — uma
      // linha de log por casa de cliente.
      respondeCom(semResultados);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(avisos.join('\n')).not.toContain('Rua Augusta');
    });

    it('o corpo da resposta de erro não é registado', async () => {
      respondeCom({ message: `Invalid query: ${MORADA}` }, false, 422);

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      expect(avisos.join('\n')).not.toContain('Rua Augusta');
    });

    it('um erro de rede não publica a URL nem o token', async () => {
      // É o caso que mais dói: a URL leva `access_token` **e** a morada, e a
      // mensagem de erro de rede costuma trazê-la inteira.
      global.fetch = jest.fn(async () => {
        throw new Error(
          'request to https://api.mapbox.com/search/geocode/v6/forward?q=Rua%20Augusta&access_token=pk.segredo failed',
        );
      }) as unknown as typeof fetch;

      await new MapboxGeocoder(configWith('pk.tok'), metricsStub()).geocode(MORADA);

      const log = avisos.join('\n');
      expect(log).not.toContain('access_token');
      expect(log).not.toContain('pk.segredo');
      expect(log).not.toContain('api.mapbox.com');
    });

    it('o saneador troca a URL por um marcador', () => {
      expect(sanitize(new Error('falha em https://api.mapbox.com/x?access_token=pk.s'))).toBe(
        'falha em [url]',
      );
    });

    it('um timeout vira uma mensagem sem detalhes', () => {
      expect(sanitize(new Error('The operation was aborted'))).toContain('timeout');
    });
  });

  describe('métricas e falhas', () => {
    it('um erro HTTP conta o status e não devolve resultado', async () => {
      const metrics = metricsStub();
      respondeCom({}, false, 429);

      const r = await new MapboxGeocoder(configWith('pk.tok'), metrics).geocode(MORADA);

      expect(r).toBeNull();
      expect(metrics.observeHttp).toHaveBeenCalledWith(429);
    });

    it('o desfecho distingue aceite de revisão', async () => {
      const aceite = metricsStub();
      respondeCom(moradaExata);
      await new MapboxGeocoder(configWith('pk.tok'), aceite).geocode(MORADA);
      expect(aceite.observe).toHaveBeenCalledWith('ok');

      const revisao = metricsStub();
      respondeCom(apenasRua);
      await new MapboxGeocoder(configWith('pk.tok'), revisao).geocode(MORADA);
      expect(revisao.observe).toHaveBeenCalledWith('needs-review');
    });
  });

  describe('limite de taxa', () => {
    it('as chamadas são espaçadas em vez de disparadas todas de uma vez', async () => {
      // Uma importação de 500 linhas em paralelo esgota o limite da conta em
      // segundos, e o resultado de um 429 é uma entrega sem coordenadas.
      const instantes: number[] = [];
      global.fetch = jest.fn(async () => {
        instantes.push(Date.now());
        return { ok: true, status: 200, json: async () => moradaExata } as Response;
      }) as unknown as typeof fetch;

      const geocoder = new MapboxGeocoder(configWith('pk.tok'), metricsStub());
      const inicio = Date.now();
      for (let i = 0; i < 4; i++) await geocoder.geocode(MORADA);

      expect(instantes).toHaveLength(4);
      // Quatro chamadas em série, a 100 ms de intervalo, levam pelo menos 300.
      expect(Date.now() - inicio).toBeGreaterThanOrEqual(280);
    });
  });
});
