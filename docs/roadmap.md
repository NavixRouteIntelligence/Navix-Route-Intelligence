# Roadmap — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.3 · **Atualizado:** 2026-07-12

Roadmap por fases, orientado a valor. As datas são indicativas; o compromisso é com o escopo e os critérios de aceite de cada fase. Cada fase só avança quando a anterior está validada (funcional, testada e documentada).

## Visão geral das fases

| Fase | Tema | Objetivo | Status |
|------|------|----------|--------|
| 0 | Fundação | Base técnica, CI/CD, segurança e multi-tenancy | ✅ Concluída (exceto Outbox — 🟡 só schema) |
| 1 | MVP de otimização | Planejar rotas com restrições básicas | 🟡 Em andamento (avançada — otimização **síncrona**; M2M e fila pendentes) |
| 2 | Tempo real | Reotimização dinâmica e rastreamento | 🟡 Parcial (tracking + POD já existem; reotimização/TimescaleDB/CQRS pendentes) |
| 3 | Inteligência | ML para ETA e previsão de demanda | ⬜ Planejado |
| 4 | Escala global | Multi-região, i18n, billing | ⬜ Planejado (i18n do frontend já existe) |

> **Nota:** alguns itens de Fases 1–2 (Import Center, Proof of Delivery, Tracking, app do motorista, configurações/perfil) já foram implementados **fora da ordem estrita das fases** para viabilizar demos. O estado por decisão está na coluna "Status da implementação" em [decisions.md](./decisions.md).

---

## Fase 0 — Fundação (Foundation)

**Objetivo:** estabelecer a base técnica sobre a qual todo o produto será construído.

**Escopo (enxuto — apenas o alicerce):**
- Estrutura do serviço NestJS (monólito modular) seguindo Clean Architecture (ver [architecture.md](./architecture.md)).
- Setup de PostgreSQL + PostGIS + Redis + **PgBouncer** (ver [database.md](./database.md)).
- Autenticação JWT + Refresh Token e RBAC básico (ver [security.md](./security.md)).
- Isolamento multi-tenant via RLS + **abstração de `TenantContext`** (evita refatoração dolorosa depois).
- **Transactional Outbox** e tabela de **audit_log** desde o início (ADR-0006) — baratos agora, caros de adicionar depois.
- Pipeline de CI/CD, lint (incl. **lint de fronteira de módulos**), testes e migrações automatizadas.
- Observabilidade base: logs estruturados + health checks. _(Tracing distribuído fica para quando houver fluxo assíncrono real — não bloquear o MVP.)_

**Critérios de aceite:**
- Usuário consegue se registrar, autenticar e operar dentro de um tenant isolado.
- Cobertura de testes mínima definida em `coding-standards.md` atingida.
- Deploy reproduzível em ambiente de staging.

## Fase 1 — MVP de otimização

**Objetivo:** entregar a primeira rota otimizada de valor real.

**Escopo:**
- CRUD de entregas, veículos, motoristas e depósitos.
- **Importação em massa** de entregas (CSV) — necessidade real de operadores logísticos (ver [api.md](./api.md)).
- Motor de otimização (VRP) atrás da port `RouteOptimizer`, **assíncrono** (ADR-0007), com restrições: janelas de tempo, capacidade e prioridade.
- **Provedor de geocodificação/roteamento abstraído** (adapter com fallback e cache de matriz por geohash) — evita lock-in e controla custo.
- Visualização de rotas e sequência de paradas.
- Endpoint para o motorista consumir a rota (autenticação M2M — ver [security.md](./security.md)).

**Simplificações deliberadas do MVP:** uma única estratégia de otimização; sem tempo real; apenas os 4 contextos essenciais (Identity, Fleet, Delivery, Routing).

**Critérios de aceite:**
- Dado um conjunto de entregas, o sistema retorna rotas otimizadas respeitando restrições.
- Redução mensurável de km vs. ordenação ingênua em cenários de teste.

## Fase 2 — Tempo real

**Objetivo:** reotimizar durante a operação.

**Escopo:**
- Ingestão de posições em **TimescaleDB** (série temporal — ADR-0009).
- Reotimização dinâmica quando há atraso, nova entrega ou cancelamento.
- Rastreamento ao vivo e ETA por parada.
- **Notificações ao cliente final** (ETA/atualizações — B2B2C) e **webhooks** para integrações.
- **Dashboards/relatórios de eficiência** via read models (CQRS — ADR-0011).

**Critérios de aceite:**
- Alteração operacional dispara reotimização com latência dentro do SLA definido.

## Fase 3 — Inteligência (ML)

**Objetivo:** aprender com o histórico para melhorar continuamente.

**Escopo:**
- Modelos de previsão de ETA e tempo de parada por tenant.
- Previsão de demanda e sugestão de janelas.
- Pipeline de features e retreino contínuo.
- Explicabilidade das recomendações.

**Critérios de aceite:**
- Precisão de ETA (MAE) supera baseline heurístico em produção.

## Fase 4 — Escala global

**Objetivo:** operar em múltiplos países com autoatendimento.

**Escopo:**
- Internacionalização (i18n), fusos, moedas e unidades.
- Billing/planos (self-service para autônomos, enterprise para frotas).
- Multi-região e residência de dados por jurisdição.
- Hardening de conformidade (LGPD/GDPR — ver [security.md](./security.md)).

**Critérios de aceite:**
- Onboarding self-service completo e cobrança automatizada.
- Conformidade de residência de dados validada.

---

## Backlog transversal (contínuo)

- Segurança: pentests periódicos, rotação de segredos/chaves, auditoria de dependências.
- Performance: benchmark do motor de otimização em escala.
- DX: melhoria de tooling, documentação e ambientes locais; **feature flags** para rollout seguro de mudanças de otimização.
- Confiabilidade: **SLOs e error budgets** explícitos (uptime, latência de otimização, precisão de ETA), alertas e resposta a incidentes.
- Onboarding/provisionamento de tenant self-service.
- Plano de **DR** com RPO/RTO definidos (ver [database.md](./database.md)).

## Como priorizamos

1. **Segurança e integridade de dados** nunca são adiadas.
2. **Valor mensurável** ao usuário (mover uma métrica de eficiência).
3. **Esforço vs. impacto** (RICE ou similar).
4. **Risco técnico** — desriscar cedo o que é incerto.

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial |
| 2026-07-05 | 0.2 | CTO | MVP enxuto, outbox/audit na Fase 0, bulk import/geocoding, TimescaleDB, dashboards, SLOs, DR, feature flags |
