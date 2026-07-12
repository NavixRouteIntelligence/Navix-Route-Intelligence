# Tenancy

Isolamento multi-tenant do backend (ver [docs/architecture.md](../../../../../docs/architecture.md) §6 e ADR-0003).

## Como funciona

1. Um guard/estratégia de autenticação valida o JWT e extrai `tenantId`, `userId` e `roles`.
2. `TenantContextStore.run(...)` estabelece o contexto para o restante da requisição (via `AsyncLocalStorage`).
3. A camada de banco define `SET app.current_tenant = <tenantId>` na transação, ativando as políticas de **RLS** do PostgreSQL.
4. Repositórios também filtram explicitamente por `tenant_id` (defesa em profundidade).

## Estado atual (implementado)

Desde o hardening da Fase 1 (ADR-0012) o isolamento por transação está **ativo**:

- `TenantTransactionInterceptor` abre uma transação por request **autenticado**, define `app.current_tenant` via `set_config(..., true)` (SET LOCAL) e executa o handler dentro dela.
- Os repositórios resolvem o `EntityManager` da transação (`transaction-context.ts` / `scopedRepository`), então toda query passa pela RLS.
- A aplicação conecta como o role **não-superusuário** `navix_app` (migração `CreateAppRole`), pois superusuários/owners ignoram a RLS mesmo com `FORCE`.
- Todas as tabelas de negócio têm `FORCE ROW LEVEL SECURITY` + política `tenant_isolation`. Coberto pelo e2e `test/tenant-isolation.e2e-spec.ts`.

Requests **públicos** (sem `req.user`, como login/refresh) passam sem transação de tenant; as tabelas de auth ficam sem RLS por isso.

## Roadmap

- Estratégia de multi-tenancy para enterprise (schema/DB por tenant) — quando houver exigência de residência de dados.
