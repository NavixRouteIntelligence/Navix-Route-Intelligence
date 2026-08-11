import type { CachePort } from '../../../../shared/cache/cache.port';
import type { LatLng } from '../../../../shared/kernel/geo';
import type {
  RouteGeometry,
  RouteGeometryProviderPort,
} from '../../domain/ports/route-geometry.port';
import { CachedRouteGeometryProvider } from './cached-route-geometry.provider';

function memoryCache() {
  const store = new Map<string, unknown>();
  const chaves: string[] = [];
  const port: CachePort = {
    async get<T>(key: string) {
      chaves.push(key);
      return (store.get(key) as T) ?? null;
    },
    async set<T>(key: string, value: T) {
      store.set(key, value);
    },
    async del(key: string) {
      store.delete(key);
    },
    async getOrSet<T>(key: string, _ttl: number, factory: () => Promise<T>) {
      if (store.has(key)) return store.get(key) as T;
      const v = await factory();
      store.set(key, v);
      return v;
    },
  };
  return { port, store, chaves };
}

const a: LatLng = { latitude: 38.72, longitude: -9.13 };
const b: LatLng = { latitude: 38.73, longitude: -9.14 };
const c: LatLng = { latitude: 38.74, longitude: -9.15 };

const tracado: RouteGeometry = {
  coordinates: [
    [-9.13, 38.72],
    [-9.14, 38.73],
  ],
  profile: 'driving',
  coveredStops: 2,
};

function delegateQueDevolve(valor: RouteGeometry | null) {
  const chamadas: LatLng[][] = [];
  const delegate: RouteGeometryProviderPort = {
    async geometry(points) {
      chamadas.push(points);
      return valor;
    },
  };
  return { delegate, chamadas };
}

describe('CachedRouteGeometryProvider', () => {
  it('a segunda leitura não chega ao provedor', async () => {
    const { port } = memoryCache();
    const { delegate, chamadas } = delegateQueDevolve(tracado);
    const cached = new CachedRouteGeometryProvider(port, delegate, 'mapbox');

    await cached.geometry([a, b]);
    const segunda = await cached.geometry([a, b]);

    expect(chamadas).toHaveLength(1);
    expect(segunda).toEqual(tracado);
  });

  it('a ordem faz parte da chave', async () => {
    // A→B→C e C→B→A são traçados diferentes: num sentido único são ruas
    // diferentes. Uma chave que ordenasse os pontos devolveria a linha ao
    // contrário depois de uma reorganização.
    const { port } = memoryCache();
    const { delegate, chamadas } = delegateQueDevolve(tracado);
    const cached = new CachedRouteGeometryProvider(port, delegate, 'mapbox');

    await cached.geometry([a, b, c]);
    await cached.geometry([c, b, a]);

    expect(chamadas).toHaveLength(2);
  });

  it('o perfil faz parte da chave', async () => {
    // Sem isto, uma rota de bicicleta reaproveitaria o traçado de carro pelos
    // mesmos pontos — silenciosamente, e só com o cache quente.
    const { port } = memoryCache();
    const { delegate, chamadas } = delegateQueDevolve(tracado);
    const cached = new CachedRouteGeometryProvider(port, delegate, 'mapbox');

    await cached.geometry([a, b], 'car');
    await cached.geometry([a, b], 'bicycle');

    expect(chamadas).toHaveLength(2);
  });

  it('a ausência de traçado não fica em cache', async () => {
    // Um pico de dez segundos deixaria a rota sem linha durante meio dia, e o
    // motorista não teria como perceber porquê nem como recuperar.
    const { port, store } = memoryCache();
    const { delegate, chamadas } = delegateQueDevolve(null);
    const cached = new CachedRouteGeometryProvider(port, delegate, 'mapbox');

    await cached.geometry([a, b]);
    await cached.geometry([a, b]);

    expect(chamadas).toHaveLength(2);
    expect(store.size).toBe(0);
  });

  it('um cache indisponível não altera o resultado', async () => {
    const quebrado: CachePort = {
      get: async () => {
        throw new Error('redis fora');
      },
      set: async () => {
        throw new Error('redis fora');
      },
      del: async () => undefined,
      getOrSet: async (_k, _t, f) => f(),
    };
    const { delegate, chamadas } = delegateQueDevolve(tracado);
    const cached = new CachedRouteGeometryProvider(quebrado, delegate, 'mapbox');

    // *Best-effort* é o contrato do CachePort. A primeira versão disto deixava
    // a exceção subir — e uma indisponibilidade do Redis apagaria o traçado de
    // **todas** as rotas ao mesmo tempo, sem nada visível a dizer porquê.
    await expect(cached.geometry([a, b])).resolves.toEqual(tracado);
    expect(chamadas).toHaveLength(1);
  });

  it('menos de dois pontos nem consulta o cache', async () => {
    const { port, chaves } = memoryCache();
    const { delegate, chamadas } = delegateQueDevolve(tracado);
    const cached = new CachedRouteGeometryProvider(port, delegate, 'mapbox');

    expect(await cached.geometry([a])).toBeNull();
    expect(chaves).toHaveLength(0);
    expect(chamadas).toHaveLength(0);
  });
});
