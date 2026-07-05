# Tenancy

Isolamento multi-tenant do backend (ver [docs/architecture.md](../../../../../docs/architecture.md) §6 e ADR-0003).

## Como funciona

1. Um guard/estratégia de autenticação valida o JWT e extrai `tenantId`, `userId` e `roles`.
2. `TenantContextStore.run(...)` estabelece o contexto para o restante da requisição (via `AsyncLocalStorage`).
3. A camada de banco define `SET app.current_tenant = <tenantId>` na transação, ativando as políticas de **RLS** do PostgreSQL.
4. Repositórios também filtram explicitamente por `tenant_id` (defesa em profundidade).

## A implementar nas próximas etapas

- Interceptor/middleware que popula o `TenantContext` a partir do usuário autenticado.
- Provider de conexão/transação que aplica `app.current_tenant` por request.

> Nesta Fase 0 disponibilizamos apenas o **contexto** e o contrato. A ativação de RLS por transação é ligada quando o primeiro módulo de negócio persistir dados escopados por tenant.
