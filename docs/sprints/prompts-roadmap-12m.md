# Prompts do Roadmap 12 meses — para o Claude Code

> Um prompt por item do roadmap (`docs/strategy/navix-evolucao-estrategica.md`).
> **Regras de uso:**
> 1. Rode **um por vez** e valide antes de seguir (o ponto de controle é seu).
> 2. Sempre abra o Claude Code na raiz: `cd ~/Claude/Projects/"Navix Route Intelligence" && claude`
> 3. Depois de cada entrega, cole o **prompt de fechamento** (fim deste arquivo).
> 4. Itens marcados **[INVESTIGAR ANTES]** têm risco de contrato/arquitetura: exija
>    que o Code leia e te reporte o achado **antes** de escrever código.

---

## T1 — Provar o ciclo e destravar a base

### T1.1 — Ciclo do motorista autônomo (já detalhado)
```
Leia docs/sprints/sprint-motorista-autonomo.md e implemente o item S1. Não faça S2/S3/S4
ainda. Siga a "Definição de pronto" do plano (reuso máximo, i18n nos 4 locales, testes de
cubit, erros via Failure, sem duplicação). Não altere o backend. Ao final rode
flutter analyze e flutter test e faça um commit descritivo.
```
> (S2, S3 e S4 têm prompts prontos no próprio `sprint-motorista-autonomo.md` — use aqueles.)

### T1.2 — Fechar o R2 operacional (IaC + CD + backup testado + teste de carga) **[INVESTIGAR ANTES]**
```
Leia docs/infrastructure/README.md, docs/infrastructure/runbook-dr.md, infra/terraform/ e
.github/workflows/deploy.yml. Primeiro me diga o estado atual: o que da infra em docs/ já
foi realmente aplicado vs. só escrito, e o que falta para um deploy reprodutível.

Depois, sem redesenhar o que já existe, entregue em passos pequenos: (a) validar/ajustar o
Terraform para um `terraform plan` limpo em eu-central-1; (b) revisar o deploy.yml de CD;
(c) um cenário de teste de carga com k6 (ingestão de posições + otimizações concorrentes +
SSE aberto), medindo p50/p95/p99 e o ponto de saturação — rodando DEPOIS que a arquitetura
de produção (worker dedicado) estiver de pé. Documente cada passo. Commits pequenos, um ADR
se houver decisão relevante. NÃO aplique nada em produção sem eu aprovar o plan.
```

### T1.3 — Worker dedicado + fila durável (BullMQ)
```
Objetivo: tirar a otimização de dentro da API e rodá-la no worker dedicado, como o
blueprint infra/render/render.yaml já prevê (navix-worker, OPTIMIZER_QUEUE_DRIVER=bullmq).

Leia apps/api/src/modules/optimizer (fila, worker, ADR-0055) e o main-worker. Confirme o
que falta para: API enfileirar em bullmq (OPTIMIZER_WORKER_ENABLED=false) e o worker
consumir com retry/backoff/redelivery. Não reescreva o que já existe. Garanta idempotência
e que um restart não perca job. Testes cobrindo enfileirar + consumir + falha/retry.
Documente a mudança de topologia e como reverter para inprocess. Commit + resumo técnico.
```

### T1.4 — Definição de planos SaaS e modelo de custo (parte de precificação)
```
Leia docs/infrastructure/custo-por-tenant.md e docs/roadmap.md (Fase 4). NÃO implemente
billing ainda. Produza um documento docs/strategy/pricing-navix.md com: 3 tiers (autônomo
self-service, frota, enterprise), o que entra em cada um (mapeando features REAIS já
existentes + as premium do roadmap), e a fórmula de margem por tenant ligada aos
direcionadores de custo reais (otimizações/dia, posições ingeridas, chamadas de mapa, mídia
POD). Marque claramente o que depende do teste de carga (T1.2) para ter número confiável.
```

### T1.5 — CX do destinatário (MVP): rastreamento público + ETA básico **[INVESTIGAR ANTES]**
```
Este é o item de maior ROI competitivo do roadmap. Comece investigando: leia o módulo de
tracking e delivery na API, e confirme como uma entrega expõe posição/status hoje. Me
reporte o que existe antes de codar.

Depois, entregue um MVP sem redesenhar nada: (a) um token público por entrega (não expõe
PII além do necessário); (b) endpoint público read-only de status+ETA para esse token;
(c) a página track.navix.pt (rota pública no app web) mostrando status, mapa e ETA. ETA
pode ser a heurística atual nesta fase (o modelo real vem em T3). Segurança: rate limit no
endpoint público, sem vazar dados de outros tenants (validar RLS). i18n, estados, testes.
Registre um ADR para o modelo de token público. Commit + resumo técnico.
```

---

## T2 — Tempo real e motor de crescimento

### T2.1 — Reotimização dinâmica em tempo real **[INVESTIGAR ANTES]**
```
Depende de T1.3 (worker BullMQ ativo). Leia ADR-0023 (OPTIMIZER_AUTO_REOPTIMIZE) e como o
Optimizer reage a eventos de Delivery/Tracking. Me diga o que já está preparado antes de
codar.

Entregue: gatilho por evento (atraso, nova entrega, cancelamento) que reenfileira a
otimização com debounce, respeitando o tenant. Sem reescrever o motor. Definir SLA de
latência da reotimização e medir. Feature flag por plano (é premium). Testes do fluxo
evento→reenfileirar→novo plano. Commit + ADR + resumo técnico.
```

### T2.2 — CX do destinatário completo: notificações + growth loop
```
Estende T1.5. Adicione notificações ao destinatário (e-mail no MVP; WhatsApp/SMS como
provedores plugáveis atrás de uma port, sem lock-in) nos eventos: saiu para entrega,
próximo de você, entregue, atrasado. Cada notificação carrega o link de rastreio (growth
loop = a marca aparece para o consumidor final). Preferências e opt-out. Não redesenhe o
tracking. Provedores atrás de adapter com fallback. Testes + i18n. Commit + resumo técnico.
```

### T2.3 — Convite de motorista / multi-usuário (abre o B2B com frota) **[INVESTIGAR ANTES]**
```
Leia o módulo identity (RBAC, papéis driver/admin/dispatcher/fleet_manager) e o
beta-roadmap.md item 1. Me reporte o que já existe de RBAC e o que falta para uma empresa
convidar um driver para o SEU tenant.

Entregue: fluxo de convite (empresa gera convite → motorista aceita e entra no tenant da
empresa, como role driver) e o vínculo entrega↔motorista real, destravando a visão de frota
do tracking com motoristas reais. Isolamento multi-tenant é crítico: um convite não pode
cruzar tenants. Testes de RBAC e de isolamento (RLS). ADR para o modelo de convite. Web +
mobile onde necessário. Commit + resumo técnico.
```

### T2.4 — Observabilidade acionável + segurança de registro
```
Leia docs/observability.md e o que já existe de alertas (ADR-0057) e rate limiting. Sem
redesenhar: (a) ligar os alertas do Alertmanager a um canal de on-call (webhook/Slack/
PagerDuty configurável por env); (b) captcha + rate limit reforçado no registro/login
(beta-roadmap 21); (c) revisar headers/WAF de borda. Testes onde aplicável. Documente o
runbook de alerta→ação. Commits pequenos + resumo técnico.
```

---

## T3 — Inteligência que aprende

### T3.1 — Modelo real de ETA / tempo de parada (liga o flywheel) **[INVESTIGAR ANTES]**
```
Este é o fosso competitivo. Leia os ports de IA (TrafficModelPort, ParkingPredictorPort) e
o mecanismo de observações coletivas (agregação por célula ~110m). Me diga exatamente que
dado já é coletado e onde, ANTES de propor o modelo.

Entregue por etapas: (a) garantir a coleta histórica em TimescaleDB (ADR-0009) se ainda não
ativa; (b) pipeline de features por tenant + célula; (c) um baseline de modelo de ETA
treinável offline, servido atrás do port existente (troca heurística→modelo SEM tocar nos
consumidores); (d) métrica de acurácia (MAE) vs. baseline heurístico. Comece pelo baseline
mensurável, não pelo modelo perfeito. ADRs para dados e serving. Commit + resumo técnico.
```

### T3.2 — Previsão de atrasos + alertas inteligentes
```
Depende de T3.1. Deriva do modelo de ETA um sinal preditivo de risco de estouro de janela/
SLA por parada, e conecta a alertas para a empresa ("rota X vai atrasar") e ao destinatário
("seu pacote vai atrasar ~20 min"). Reusa os canais de notificação (T2.2) e alertas (T2.4).
Feature flag (premium). Testes do gatilho preditivo. Commit + resumo técnico.
```

### T3.3 — Dashboards por read model (CQRS) + KPIs de eficiência **[INVESTIGAR ANTES]**
```
Leia ADR-0011 (CQRS) e o estado atual dos relatórios. Me diga se há read models ou se hoje
tudo sai das tabelas transacionais.

Entregue read models para os KPIs que justificam a assinatura: km economizado vs. baseline
ingênuo, custo/entrega, taxa de sucesso, on-time %. Dashboards no web consumindo os read
models (não as tabelas transacionais). Historização via TimescaleDB. Sem redesenhar o
dashboard atual — evoluí-lo. Testes + i18n. ADR se necessário. Commit + resumo técnico.
```

### T3.4 — Premium empacotado (feature flags por plano)
```
Leia docs/strategy/pricing-navix.md (criado em T1.4). Implemente o gating por plano
(feature flags) que libera: reotimização em tempo real (T2.1), IA preditiva (T3.2) e CX
avançado do destinatário. Sem duplicar lógica — um único mecanismo de flag por tenant/plano.
Testes de que um plano básico não acessa recurso premium. Commit + resumo técnico.
```

---

## T4 — Plataforma e escala

### T4.1 — API pública + Webhooks
```
Leia docs/api.md e como a API é versionada/contratada hoje. Entregue: chaves de API
públicas por tenant (com escopo e quota/rate limit), documentação pública dos endpoints
principais, e webhooks de saída para eventos (entrega criada/atualizada, POD, ETA). Não
reescreva a API interna — exponha uma camada pública sobre ela. Segurança: as chaves
respeitam RLS e escopo de tenant. Testes + docs. ADR para o modelo de API key pública.
Commit + resumo técnico.
```

### T4.2 — Agrupamento inteligente + navegação integrada + automações
```
Três melhorias independentes, faça uma por commit: (a) clustering de entregas por zona/
janela/veículo no motor de otimização (reusa cache de matriz por geohash); (b) navegação
turn-by-turn via deep link com retorno de contexto à rota no app; (c) automação de status
por geofence usando o dwell/detecção de parada que já existe no app. Não redesenhe o
otimizador nem o dashboard do motorista — estenda. Testes por item. Commits + resumo técnico.
```

### T4.3 — White-label / Enterprise (base) **[INVESTIGAR ANTES]**
```
Leia como o multi-tenant por subdomínio (*.navix.pt) e o RBAC estão montados. Me reporte o
que já suporta personalização por tenant antes de codar.

Entregue a BASE de white-label sem prometer tudo: marca/logo/cores por tenant, domínio
próprio por tenant, e o esqueleto de SSO (SAML/OIDC) atrás de uma port. Isolamento reforçado
e SLA são requisitos enterprise — documente o gap. ADR para a estratégia de white-label.
Commit + resumo técnico.
```

### T4.4 — Preparação de multi-região (tenant-pinning) **[INVESTIGAR ANTES]**
```
NÃO implemente multi-região ainda — é caro e arriscado. Leia docs/roadmap.md (Fase 4) e a
arquitetura multi-tenant atual. Produza um documento docs/strategy/multi-region-plan.md com:
como fixar tenants por região (UE vs BR), o que muda no banco/roteamento/deploy, os riscos,
e os critérios (volume/compliance) que justificam começar. Entregue o PLANO, não o código.
```

### T4.5 — Gamificação / produtividade do motorista
```
Leia o dashboard do motorista. Adicione, sem redesenhá-lo: visão de ganhos/desempenho
consolidado, metas e streaks saudáveis. RESTRIÇÃO ÉTICA OBRIGATÓRIA: nada que incentive
direção perigosa, excesso de jornada ou pressão nociva — sem rankings que empurrem risco.
i18n, testes, acessibilidade. Commit + resumo técnico.
```

---

## Prompt de fechamento (colar após CADA entrega)
```
Me dê um resumo técnico da entrega: (1) o que mudou e por quê, (2) arquivos afetados,
(3) decisões de arquitetura (e se abriu ADR), (4) riscos introduzidos e como mitigou,
(5) o que ficou explicitamente fora de escopo, (6) cobertura de testes adicionada,
(7) sua recomendação de merge (aprovar / ajustar / bloquear) com justificativa.
Se algo violou multi-tenant, RLS, i18n ou a Definição de Pronto, sinalize antes de tudo.
```

## Prompt de segurança (colar quando a mudança tocar auth, dados ou API pública)
```
Faça uma revisão de segurança desta mudança contra o OWASP Top 10 e as regras do projeto
(RLS multi-tenant, JWT RS256, criptografia de dados sensíveis, validação de entrada). Liste
o que verificou e qualquer risco residual. Não prossiga para merge se houver vazamento
entre tenants.
```
