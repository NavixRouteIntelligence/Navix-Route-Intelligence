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

**Fase 0 — Fundação.** Apenas estrutura base: arquitetura, configuração, Docker, banco e autenticação inicial. Funcionalidades de negócio (frota, entregas, otimização) ainda **não** implementadas — ver [docs/roadmap.md](./docs/roadmap.md).
