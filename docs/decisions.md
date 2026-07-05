# Registro de decisões (ADRs) — Navix Route Intelligence

> **Status:** Em revisão · **Versão:** 0.2 · **Atualizado:** 2026-07-05

Este arquivo mantém os **Architecture Decision Records**. Toda decisão técnica significativa (arquitetura, stack, segurança, dados, processo) deve ser registrada aqui, de forma imutável. Decisões não se apagam: quando mudam, cria-se um novo ADR que **supera** (supersedes) o anterior.

## Como registrar um ADR

1. Copie o [template](#template) para o fim da lista.
2. Numere sequencialmente (`ADR-0001`, `ADR-0002`, …).
3. Defina o status: `Proposto` · `Aceito` · `Rejeitado` · `Substituído` · `Depreciado`.
4. Abra no mesmo PR da mudança que a decisão afeta.

## Índice

| ID | Título | Status | Data |
|----|--------|--------|------|
| ADR-0000 | Adoção do processo de ADR | Aceito | 2026-07-05 |
| ADR-0001 | Stack de backend: NestJS + TypeScript | Aceito | 2026-07-05 |
| ADR-0002 | Persistência: PostgreSQL + PostGIS e Redis | Aceito | 2026-07-05 |
| ADR-0003 | Estratégia de multi-tenancy inicial | Aceito | 2026-07-05 |
| ADR-0004 | Autenticação com JWT + Refresh Token | Aceito | 2026-07-05 |
| ADR-0005 | ORM: TypeORM (compatível com RLS) | Aceito | 2026-07-05 |
| ADR-0006 | Transactional Outbox para eventos de domínio | Aceito | 2026-07-05 |
| ADR-0007 | Motor de otimização como serviço isolável (port) | Aceito | 2026-07-05 |
| ADR-0008 | Chaves primárias UUIDv7 (ordenáveis) | Aceito | 2026-07-05 |
| ADR-0009 | Telemetria de posições em série temporal | Aceito | 2026-07-05 |
| ADR-0010 | Envelope encryption com chave por tenant | Aceito | 2026-07-05 |
| ADR-0011 | CQRS leve com read models para relatórios | Aceito | 2026-07-05 |

---

## ADR-0000 — Adoção do processo de ADR

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** Precisamos registrar decisões técnicas de forma rastreável e durável.
- **Decisão:** Adotar ADRs neste arquivo, imutáveis e versionados junto ao código.
- **Consequências:** Histórico claro de "por que" cada escolha foi feita; leve overhead por decisão.

## ADR-0001 — Stack de backend: NestJS + TypeScript

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** Precisamos de um framework que favoreça modularidade, DI e Clean Architecture/DDD.
- **Decisão:** Node.js + **NestJS** com **TypeScript** em modo strict.
- **Alternativas consideradas:** Express/Fastify puro (mais leve, porém mais boilerplate estrutural).
- **Consequências:** DI e modularização nativas alinhadas à arquitetura; curva de aprendizado do Nest; acoplamento a convenções do framework contido na camada de interface/infra.

## ADR-0002 — Persistência: PostgreSQL + PostGIS e Redis

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** O domínio é fortemente geoespacial e exige cache/filas de baixa latência.
- **Decisão:** **PostgreSQL 16 + PostGIS** como fonte de verdade; **Redis 7** para cache, filas, sessões e rate limiting.
- **Alternativas consideradas:** Postgres sem PostGIS + cálculo externo; bancos NoSQL geoespaciais.
- **Consequências:** Consultas espaciais nativas e maduras; necessidade de expertise em PostGIS e em modelagem multi-tenant.

## ADR-0003 — Estratégia de multi-tenancy inicial

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** Produto SaaS multi-tenant global; isolamento de dados é crítico.
- **Decisão:** Banco único com coluna `tenant_id` + **Row-Level Security (RLS)**, reforçado por filtro na aplicação.
- **Alternativas consideradas:** Schema-por-tenant; database-por-tenant (mais isolamento, mais custo operacional).
- **Consequências:** Simplicidade e custo baixo no início; evolução para schema/DB por tenant prevista para enterprise/residência de dados (exigirá novo ADR).

## ADR-0004 — Autenticação com JWT + Refresh Token

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** APIs stateless multi-tenant precisam de autenticação segura e escalável.
- **Decisão:** **JWT** de curta duração + **Refresh Token** rotacionado e revogável (hash no banco), com detecção de reuso.
- **Alternativas consideradas:** Sessões server-side puras; tokens opacos com introspecção.
- **Consequências:** Escalabilidade stateless; complexidade de rotação/revogação e necessidade de blacklist no Redis. Detalhes em [security.md](./security.md).

## ADR-0005 — ORM: TypeORM (compatível com RLS)

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** A estratégia de multi-tenancy (ADR-0003) depende de definir `SET app.current_tenant` por transação e de RLS. Precisávamos resolver a decisão de ORM que estava em aberto.
- **Decisão:** Adotar **TypeORM**, que permite controle transacional explícito, execução de SQL bruto e definição de variáveis de sessão por conexão — requisitos para RLS confiável e para consultas geoespaciais (PostGIS).
- **Alternativas consideradas:** **Prisma** (DX excelente, porém suporte histórico limitado a variáveis de sessão/RLS e a tipos PostGIS); **Drizzle** (leve, mas ecossistema menos maduro para este caso).
- **Consequências:** Mais boilerplate que Prisma; em troca, RLS e PostGIS bem suportados. Repositórios ficam atrás de *ports* do domínio, então uma futura troca de ORM fica contida na infraestrutura.

## ADR-0006 — Transactional Outbox para eventos de domínio

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** Publicar eventos (ex.: `RoutePlanned`) e gravar estado no banco em operações separadas cria *dual-write* — risco de perder eventos ou emitir eventos de transações que falharam.
- **Decisão:** Usar o padrão **Transactional Outbox**: o evento é gravado na mesma transação do agregado, e um *relay* assíncrono publica na fila (Redis/BullMQ hoje, broker dedicado no futuro). Consumidores são **idempotentes**.
- **Alternativas consideradas:** Publicação direta pós-commit (sujeita a perda); 2PC/XA (complexo e pouco escalável).
- **Consequências:** Garante consistência eventual confiável entre estado e eventos; adiciona uma tabela `outbox` e um processo de relay. Base para reotimização em tempo real (Fase 2) e ML (Fase 3).

## ADR-0007 — Motor de otimização como serviço isolável (port)

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** A resolução do VRP é CPU-intensiva, tem perfil de escala diferente da API e pode exigir linguagem/solver especializados. Embutir a lógica no request bloquearia o processo e dificultaria a extração futura.
- **Decisão:** Definir o otimizador atrás de uma **port** (`RouteOptimizer`) desde o início, executado de forma **assíncrona via fila** e **stateless**. Começa in-process/worker no MVP, mas com contrato que permite extrair para microserviço com escala horizontal sem reescrita.
- **Alternativas consideradas:** Solver acoplado ao caso de uso (mais simples, porém difícil de escalar/extrair).
- **Consequências:** Leve overhead de abstração no MVP; ganho grande de escalabilidade e de liberdade de tecnologia do solver depois.

## ADR-0008 — Chaves primárias UUIDv7 (ordenáveis)

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** UUIDv4 é aleatório e, em escala de milhões de linhas, fragmenta índices B-tree e degrada inserção/locality.
- **Decisão:** Usar **UUIDv7** (ordenável por tempo) como PK padrão. Mantém a vantagem de não-enumerável, com *locality* de índice próxima a um inteiro sequencial.
- **Alternativas consideradas:** UUIDv4 (fragmentação); BIGSERIAL (enumerável, ruim para multi-tenant exposto); ULID (equivalente, porém UUIDv7 é padrão e nativo em ferramentas).
- **Consequências:** Melhor performance de escrita e de índice em alta escala; exige gerador UUIDv7 (lib) até suporte nativo no Postgres.

## ADR-0009 — Telemetria de posições em série temporal

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** `vehicle_positions` é o maior volume do sistema (milhões de pontos/dia em escala) e tem perfil de escrita e retenção distinto do OLTP transacional.
- **Decisão:** Armazenar posições em store de **série temporal** — **TimescaleDB** (extensão do próprio Postgres) com *hypertables*, compressão e *retention/downsampling* — separado das tabelas transacionais.
- **Alternativas consideradas:** Tabela Postgres comum particionada (funciona, mas sem compressão/downsampling nativos); store dedicado externo (mais peças operacionais no MVP).
- **Consequências:** Escala de ingestão e custo de storage controlados, mantendo SQL/PostGIS. Introduz a extensão TimescaleDB na stack.

## ADR-0010 — Envelope encryption com chave por tenant

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** SaaS global com PII exige isolamento criptográfico forte e suporte a residência de dados e a "direito ao esquecimento".
- **Decisão:** **Envelope encryption**: cada tenant tem uma **DEK** (Data Encryption Key) própria, protegida por uma **KEK** no KMS. Dados sensíveis são cifrados com AES-256-GCM usando a DEK do tenant. *Crypto-shredding* (destruir a DEK) permite exclusão lógica irreversível.
- **Alternativas consideradas:** Chave única global (raio de exposição maior, sem crypto-shredding por tenant).
- **Consequências:** Isolamento e conformidade mais fortes; exige KMS e versionamento/rotação de chaves. Detalhes em [security.md](./security.md).

## ADR-0011 — CQRS leve com read models para relatórios

- **Status:** Aceito · **Data:** 2026-07-05
- **Contexto:** Dashboards e relatórios de eficiência (KPIs de [vision.md](./vision.md)) fazem agregações pesadas que competem com o OLTP e não escalam para milhares de tenants.
- **Decisão:** **CQRS leve**: manter escrita normalizada e projetar **read models** (materializações/tabelas de leitura, alimentadas por eventos do outbox) para consultas analíticas, servidas por **réplicas de leitura**.
- **Alternativas consideradas:** Consultar direto o OLTP (não escala); data warehouse completo (over-engineering para o estágio atual).
- **Consequências:** Leitura escalável e barata; custo de manter projeções consistentes. Evolui para warehouse dedicado quando a Fase 3 (Intelligence) exigir.

---

## Template

```markdown
## ADR-XXXX — <título curto>

- **Status:** Proposto | Aceito | Rejeitado | Substituído por ADR-YYYY | Depreciado
- **Data:** AAAA-MM-DD
- **Contexto:** Qual problema/força motriz levou a esta decisão?
- **Decisão:** O que foi decidido, de forma direta.
- **Alternativas consideradas:** Opções avaliadas e por que foram preteridas.
- **Consequências:** Impactos positivos e negativos; trade-offs; o que passa a ser exigido.
```

---

### Histórico

| Data | Versão | Autor | Mudança |
|------|--------|-------|---------|
| 2026-07-05 | 0.1 | Engenharia | Estrutura inicial + ADRs 0000–0004 |
| 2026-07-05 | 0.2 | CTO | Revisão: ADRs 0005–0011 (ORM, outbox, otimizador, UUIDv7, série temporal, envelope encryption, CQRS) |
