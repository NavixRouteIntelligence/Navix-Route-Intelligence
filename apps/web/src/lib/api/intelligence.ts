import type {
  CollectiveInsightView,
  LoadPlanRequest,
  LoadPlanView,
  RecordObservationRequest,
  RecordObservationResult,
  ResourceResponse,
  RouteForecastRequest,
  RouteIntelligenceReport,
} from '@navix/contracts';

import { apiRequest } from './client';

/** Cliente da Navix Intelligence (ADR-0025/0028/0029/0030/0031). */
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

  /** Inteligência coletiva: registra uma observação de campo do motorista. */
  recordObservation: (body: RecordObservationRequest) =>
    apiRequest<ResourceResponse<RecordObservationResult>>('/intelligence/observations', {
      method: 'POST',
      body,
    }),

  /** Inteligência coletiva: insight agregado da comunidade por coordenada. */
  collectiveInsight: (latitude: number, longitude: number) =>
    apiRequest<ResourceResponse<CollectiveInsightView>>(
      `/intelligence/insights?latitude=${latitude}&longitude=${longitude}`,
      { method: 'GET' },
    ),
};
