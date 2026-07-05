# Relatório técnico — Route Optimizer (Fase 1)

> **Status:** Concluído (aguardando validação de build/testes local) · **Data:** 2026-07-05

## 1. O que foi implementado

Motor de otimização de rota **heurístico, desacoplado e extensível** (sem ML), em Clean Architecture + DDD:

- **Domínio:** `GeoPoint` (VO), `OptimizationStop`, agregado `RoutePlan` (resultado persistível), e **duas portas de extensão**: `RouteOptimizationStrategy` (Strategy Pattern) e `DistanceProvider`.
- **Aplicação:** `OptimizeRouteUseCase` (orquestra matriz → estratégia → métricas → score → persistência → auditoria), `StrategyRegistry` (seleção por nome), `scoring` (métricas, economia, score, explicação), casos de uso de consulta (`Get`, `List`), portas anti-corrupção (`DeliveryGateway`) e de repositório.
- **Infraestrutura:** `HaversineDistanceProvider` (great-circle, sem dependências), estratégia **`NearestNeighbor + 2-opt`** com função de custo composta (distância + janela + prioridade) e orçamento de tempo, `RoutePlanRepository` (TypeORM), `DeliveryGateway` (consome a API pública `DeliveryLookup`).
- **Interface:** `OptimizerController` (`POST /route-plans`, `GET /route-plans`, `GET /route-plans/:id`), DTOs validados + anotados para Swagger, JWT + RBAC.
- **Persistência:** migração `route_plans` (sequência/métricas em JSONB, score com CHECK 0–100, índice por tenant, RLS).
- **Integração:** o Delivery passou a **expor `DeliveryLookup`** (+`findByIds`); o Optimizer consome via porta anti-corrupção — sem tocar internals do Delivery (fronteira verificada).

## 2. Requisitos do MVP × entregue

| Requisito | Status |
|-----------|--------|
| Receber lista de entregas (inline **ou** por IDs) | ✅ |
| Considerar lat/lng | ✅ (Haversine) |
| Sequência otimizada | ✅ (NN + 2-opt) |
| Minimizar distância | ✅ (objetivo primário) |
| Minimizar tempo | ✅ (tempo = distância/velocidade + serviço) |
| Prioridades | ✅ (penalidade por inversão de prioridade) |
| Janelas de horário | ✅ (restrição suave: penaliza atraso, reporta viabilidade) |
| Métricas da rota | ✅ |
| Ordem ideal, distância/tempo totais, nº paradas | ✅ |
| Economia (km, tempo, %) vs. ordem original | ✅ |
| Score 0–100 | ✅ (50% janelas + 30% prioridade + 20% eficiência) |
| Explicação resumida | ✅ |

## 3. Requisitos arquiteturais × entregue
- **Algoritmo desacoplado da API/UI:** ✅ via porta `RouteOptimizationStrategy`.
- **Strategy Pattern para novos algoritmos/IA:** ✅ estratégias registradas como multi-provider; adicionar uma nova não altera API nem domínio (ADR-0007).
- **Fonte de distância abstraída:** ✅ `DistanceProvider` (Haversine hoje; matriz real/trânsito depois).

## 4. Não implementado (por escopo — próximas fases)
ML, aprendizado contínuo, trânsito em tempo real, clima, reotimização dinâmica, copiloto de IA, previsão de congestionamento. A arquitetura já acomoda: bastam novas estratégias/providers atrás das portas existentes.

## 5. Testes
- **Unitários:** Haversine (distância conhecida, simetria, zero); estratégia (permutação válida, 2-opt não piora e melhora no caso de cruzamento, origem fixa); scoring (métricas, janelas violadas, economia, score ∈ [0,100]).
- **e2e (supertest):** `POST /route-plans` (201, métricas, score, otimizada ≤ baseline), `GET /:id`, validação (<2 paradas → 400) — com repositório em memória e Haversine real.
- Rodar local: `npm test -w apps/api` e `npm run test:e2e -w apps/api`. Verificação estática aqui: imports OK, JSON OK, fronteira Optimizer→Delivery só via `DeliveryLookup`.

## 6. Desempenho
- Matriz e NN O(n²); 2-opt O(n²)/passada com **orçamento de 2s** e parada por ausência de melhoria. Bom para centenas de paradas (guardrail de 500 no modo síncrono).
- Milhares: evoluir com listas de vizinhos (índice espacial), Or-opt, **modo assíncrono (job 202)** e cache da matriz (Redis) — já previsto.

## 7. Melhorias recomendadas
1. **Delta-cost incremental** no 2-opt (hoje recomputa custo O(n)) para escalar melhor.
2. **Modo assíncrono** (fila + job) para grandes volumes.
3. **Provider de distância real** (matriz com ruas/trânsito) atrás da porta.
4. **Associar o RoutePlan às entregas** (setar `routeId`) — integração opcional Delivery↔Optimizer.
5. Pesos da função de custo **tunáveis por tenant** (e futuramente aprendidos).
6. Hardening de tenant/RLS efetiva (pendente desde a Fase 0).

---

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 1.0 | Engenharia | Relatório inicial do Route Optimizer |
