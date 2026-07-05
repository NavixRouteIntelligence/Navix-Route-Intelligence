# Relatório técnico — Módulo Delivery (Fase 1)

> **Status:** Concluído (aguardando validação de build/testes local) · **Data:** 2026-07-05

## 1. O que foi implementado

Módulo **Delivery** completo, em Clean Architecture + DDD, seguindo o `/docs`:

- **Domínio:** aggregate `Delivery`; Value Objects `Address` (coordenadas validadas) e `TimeWindow` (start < end); máquina de estados (`delivery-status.ts`) com transições e estados terminais; porta de repositório.
- **Aplicação:** casos de uso `Create`, `Get`, `List` (filtros/ordenação/paginação), `Update`, `ChangeStatus`, `Delete` (soft delete); mapper de view; validador de associações; porta anti-corrupção `FleetGateway`.
- **Infraestrutura:** entidade ORM + repositório TypeORM (QueryBuilder com filtros, ordenação segura e exclusão de soft-deletadas); adaptador `FleetGateway` consumindo a API pública do Fleet.
- **Interface:** `DeliveryController` (6 rotas) protegido por JWT + RBAC (`admin`/`dispatcher`), DTOs validados com `class-validator` e anotados para Swagger.
- **Integração entre contextos:** Fleet passou a **expor `FleetLookup`**; o Delivery valida existência de motorista/veículo por uma **porta anti-corrupção** — sem tocar internals do Fleet. `routeId` é referência opaca (módulo Routing ainda não existe).
- **Auditoria:** módulo global `shared/audit` grava eventos (`delivery.created/updated/status_changed/deleted`) na tabela imutável `audit_log`.
- **Persistência:** migração `deliveries` com coluna PostGIS `location` gerada, índices parciais (ignoram soft delete), GiST espacial, CHECKs e RLS.
- **OpenAPI:** Swagger em `/api/docs` (fora de produção).

## 2. Regras de negócio aplicadas

- Escopo de tenant obrigatório; toda query filtra `tenant_id`.
- `timeWindow.start < end`; latitude ∈ [-90,90], longitude ∈ [-180,180].
- Máquina de estados: `pending→{in_route,canceled}`, `in_route→{delivered,failed,canceled}`, `failed→{in_route,canceled}`; `delivered`/`canceled` terminais → transição inválida = 409.
- Entrega em estado terminal ou soft-deletada não aceita edição.
- Associação a motorista/veículo valida existência via Fleet (404 se não existir).

## 3. Testes realizados

- **Unitários (domínio):** criação, faixas de coordenada, janela inválida, transições válidas/ inválidas, imutabilidade em estado terminal, soft delete idempotente.
- **Unitários (aplicação):** criação + auditoria, validação de associação via Fleet, transição de status (válida/ inválida/ 404).
- **Integração (e2e, supertest):** POST 201, GET lista, payload inválido 400, transição inválida 409, GET inexistente 404, soft delete 204 — com repositório em memória e guards sobrescritos (sem banco).

> Execução dos testes deve ser feita localmente (`npm test` e `npm run test:e2e -w apps/api`) — o ambiente de revisão não tem acesso ao registro npm. Verificação estática aqui: imports 100% resolvidos, JSON válido, fronteira Delivery→Fleet somente via `FleetLookup`.

## 4. Melhorias recomendadas (antes do Route Optimizer)

1. **Hardening de tenant/RLS** (pendente da Fase 0): interceptor de `TenantContext` + `SET app.current_tenant` por transação + role não-owner + `FORCE` RLS. Hoje o isolamento é por filtro explícito.
2. **Concorrência:** adicionar coluna de versão (`@VersionColumn`) para *optimistic locking* em `update`/`changeStatus`.
3. **Outbox real:** emitir eventos de domínio (`delivery.created`, etc.) via a tabela `outbox` para alimentar Tracking/Intelligence (hoje só auditoria).
4. **Validação de `routeId`:** quando o módulo Routing existir, promover de referência opaca a validação via porta.
5. **Rate limiting** (`@nestjs/throttler`) e tokens **RS256** — itens de segurança ainda abertos.
6. **Filtro de janela:** hoje filtra por `window_start`; avaliar filtro por *sobreposição* de intervalo conforme a necessidade do produto.

## 5. Endpoints

`POST/GET /api/v1/deliveries`, `GET/PATCH/DELETE /api/v1/deliveries/{id}`, `PATCH /api/v1/deliveries/{id}/status`. Detalhes em [../api.md](../api.md) §14.2.

---

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 1.0 | Engenharia | Relatório inicial do módulo Delivery |
