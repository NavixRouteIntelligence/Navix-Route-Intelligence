# Documentação — Navix Route Intelligence

Base de conhecimento oficial do projeto. Toda decisão de produto, arquitetura e engenharia deve estar refletida aqui. Documentos desatualizados são considerados bugs.

## Índice

| Documento | Descrição |
|-----------|-----------|
| [vision.md](./vision.md) | Visão, missão, problema, mercado, personas e métricas de sucesso. |
| [roadmap.md](./roadmap.md) | Planejamento por fases, marcos e escopo de cada release. |
| [architecture.md](./architecture.md) | Clean Architecture, DDD, multi-tenancy, módulos e fluxos. |
| [database.md](./database.md) | Modelo de dados, PostgreSQL/PostGIS, Redis, migrações e tenancy. |
| [security.md](./security.md) | OWASP Top 10, criptografia, autenticação, autorização e LGPD/GDPR. |
| [api.md](./api.md) | Convenções REST, versionamento, contratos, erros e paginação. |
| [coding-standards.md](./coding-standards.md) | Padrões TypeScript, SOLID, testes, lint e Git. |
| [decisions.md](./decisions.md) | Architecture Decision Records (ADRs). |

## Como usar

- **Antes de implementar** uma feature relevante, consulte `architecture.md` e `coding-standards.md`.
- **Ao tomar uma decisão técnica** significativa, registre um ADR em `decisions.md`.
- **Ao mudar contrato de API**, atualize `api.md` no mesmo PR.
- **Mudanças de schema** exigem atualização de `database.md` + migração versionada.

## Stack de referência

- **Backend:** Node.js + NestJS + TypeScript · ORM TypeORM (ADR-0005)
- **Banco:** PostgreSQL 16 + PostGIS · TimescaleDB (telemetria) · Redis 7 · PgBouncer
- **Arquitetura:** Clean Architecture + DDD, monólito modular extraível, multi-tenant (RLS), event-driven com **Transactional Outbox** e **CQRS leve**
- **Segurança:** JWT + Refresh Token, M2M via API keys/OAuth2, **envelope encryption por tenant** (AES-256), audit log imutável, OWASP Top 10

## Metas de escala

Desenhado para evoluir sem reescrita até **milhares de tenants** e **milhões de entregas/dia** (ver [architecture.md](./architecture.md) §12).

## Convenções destes documentos

- Idioma: Português (Brasil).
- Formato: Markdown, títulos em sentence case.
- Status de cada doc indicado no topo: `Rascunho` · `Em revisão` · `Estável`.
- Toda alteração relevante deve constar no histórico ao final do arquivo.

---

_Última atualização: 2026-07-05 · Revisão CTO (v0.2) · Mantenedor: Equipe de Engenharia Navix_
