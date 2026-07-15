import type {
  LoadPlanRequest,
  LoadPlanView,
  ResourceResponse,
  RouteForecastRequest,
  RouteIntelligenceReport,
} from '@navix/contracts';

import { apiRequest } from './client';

/** Cliente da Navix Intelligence (ADR-0025/0028/0029/0030). */
export const intelligenceApi = {
  /** Previsão de rota: cronograma/ETA, atrasos, combustível, saída, acesso e estacionamento. */
  routeForecast: (body: RouteForecastRequest) =>
    apiRequest<ResourceResponse<RouteIntelligenceReport>>('/intelligence/route-forecast', {
      method: 'POST',
      body,
    }),

  /** Organização otimizada da carga: sequência LIFO, zonas de estiva e ocupação. */
  loadPlan: (body: LoadPlanRequest) =>
    apiRequest<ResourceResponse<LoadPlanView>>('/intelligence/load-plan', {
      method: 'POST',
      body,
    }),
};
