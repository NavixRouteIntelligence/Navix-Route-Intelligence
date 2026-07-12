# Navix Route Intelligence

Plataforma SaaS global de inteligência logística de última milha baseada em IA. Este repositório é um **monorepo** contendo backend, frontend e pacotes compartilhados.

> Documentação completa em [`/docs`](./docs) (visão, arquitetura, segurança, API, banco, padrões e decisões).

## Stack

- **Backend:** Node.js + NestJS + TypeScript (Clean Architecture + DDD)
- **Frontend:** Next.js (React) + TypeScript
- **Banco:** PostgreSQL 16 + PostGIS · Redis 7 · PgBouncer
- **Auth:** JWT + Refresh Token (ver [docs/security.md](./docs/security.md))

## Estrutura do monorepo

```
.
├── apps/
│   ├── api/          # Backend NestJS (Clean Architecture)
│   └── web/          # Frontend Next.js
├── packages/
│   └── contracts/    # Tipos/contratos de API compartilhados (@navix/contracts)
├── docker/           # docker-compose, Dockerfiles e configs de infra
├── docs/             # Documentação do projeto
└── package.json      # Workspaces npm
```

## Pré-requisitos

- Node.js >= 20
- Docker + Docker Compose

## Setup rápido

```bash
# 1. Instalar dependências (todos os workspaces)
npm install

# 2. Compilar o pacote de contratos compartilhado (necessário antes do dev)
npm run build -w packages/contracts

# 3. Configurar variáveis de ambiente
cp .env.example .env

# 4. Subir a infraestrutura (Postgres+PostGIS, Redis, PgBouncer)
npm run docker:up

# 5. Rodar as migrações do banco
npm run migration:run

# 6. Iniciar backend e frontend (em terminais separados)
npm run dev:api    # http://localhost:3001/api
npm run dev:web    # http://localhost:3000
```

## Scripts principais

| Script | Descrição |
|--------|-----------|
| `npm run build` | Build de contracts → api → web (nessa ordem) |
| `npm run lint` | ESLint em todo o monorepo |
| `npm run format` | Prettier (escrita) |
| `npm run typecheck` | Type-check de todos os workspaces |
| `npm run test` | Testes do backend |
| `npm run docker:up` / `docker:down` | Sobe/derruba a infra local |
| `npm run migration:run` | Aplica migrações do banco |

## Status

**Fundação (Fase 0) concluída e boa parte da Fase 1 (MVP) já implementada.** O que **já existe** no código hoje:

- **Identity & Access:** registro, login, refresh com rotação e detecção de reuso, logout, troca e reset de senha, RBAC por papéis. Access token **JWT RS256** (key ring + rotação), senhas com **Argon2id**.
- **Multi-tenant com enforcement real:** `FORCE ROW LEVEL SECURITY` em todas as tabelas de negócio + role de runtime não-superusuário + interceptor de tenant por transação (ver [ADR-0012](./docs/decisions.md)).
- **Fleet:** CRUD de veículos e motoristas. **Delivery:** CRUD de entregas com janelas de tempo, prioridade e máquina de estados. **Import Center:** importação em massa (CSV/XLSX/PDF) com preview, normalização e geocodificação (Mapbox).
- **Optimizer:** motor VRP (nearest-neighbor + 2-opt) atrás de port, com endpoint para empresa e para motorista — **execução síncrona** (a fila assíncrona é roadmap).
- **Tracking** (posições de motorista) e **Proof of Delivery** (foto/assinatura), com app do motorista e suporte offline no mobile.
- **Configurações e perfil de usuário.** Frontend Next.js completo (dashboard, listagens, mapas, i18n).
- Infra: Docker (Postgres+PostGIS, Redis, PgBouncer), migrações versionadas, CI (lint, typecheck, testes, migração smoke).

**Ainda no roadmap** (documentado, mas **não** implementado — ver [docs/roadmap.md](./docs/roadmap.md) e o **Status da implementação** em [docs/decisions.md](./docs/decisions.md)): otimização assíncrona via fila/BullMQ, Transactional Outbox e eventos de domínio, uso do Redis (cache/filas/blacklist), TimescaleDB para telemetria, CQRS/read models, envelope encryption de PII, e billing/ML/multi-região.
