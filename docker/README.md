# Infraestrutura Docker — Navix

Serviços de infraestrutura local para desenvolvimento.

## Serviços

| Serviço | Imagem | Porta (host) | Função |
|---------|--------|--------------|--------|
| `postgres` | postgis/postgis:16-3.4 | 5432 | Banco relacional + PostGIS |
| `pgbouncer` | edoburu/pgbouncer | 6432 | Pool de conexões (transaction) |
| `redis` | redis:7-alpine | 6379 | Cache, filas, sessões |

## Uso

```bash
# a partir da raiz do repositório
npm run docker:up      # sobe tudo em background
npm run docker:logs    # acompanha logs
npm run docker:down    # derruba
```

## Notas

- A aplicação conecta ao banco **via PgBouncer** (porta 6432). As **migrações** conectam direto ao Postgres (porta 5432), pois DDL não deve passar pelo pooler em modo transaction.
- As extensões (`postgis`, `pgcrypto`) são criadas automaticamente no primeiro boot via `postgres/init/`.
- Dockerfiles de `api` e `web` (`api.Dockerfile`, `web.Dockerfile`) são para build/deploy da aplicação; não são necessários no fluxo de dev com `npm run dev:*`.
- **TimescaleDB** (telemetria) entra na Fase 2 — ver [../docs/roadmap.md](../docs/roadmap.md).
