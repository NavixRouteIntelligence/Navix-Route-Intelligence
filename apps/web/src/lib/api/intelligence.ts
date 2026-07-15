import type {
  ResourceResponse,
  RouteForecastRequest,
  RouteIntelligenceReport,
} from '@navix/contracts';

import { apiRequest } from './client';

/** Cliente da Navix Intelligence (ADR-0025/0028). */
export const intelligenceApi = {
  /** Previsão de rota: cronograma/ETA, atrasos, combustível, saída e acesso ao destino. */
  routeForecast: (body: RouteForecastRequest) =>
    apiRequest<ResourceResponse<RouteIntelligenceReport>>('/intelligence/route-forecast', {
      method: 'POST',
      body,
    }),
};
