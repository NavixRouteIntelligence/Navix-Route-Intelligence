# Precificação Navix — planos SaaS e modelo de margem

> **O que este documento é:** a definição dos três planos comerciais e a fórmula que
> liga cada plano ao custo real de servi-lo. É a peça de **precificação** da T1.4.
>
> **O que este documento NÃO é:** implementação de billing. Nada aqui cria cobrança,
> gateway de pagamento ou enforcement de plano — isso é Fase 4 do
> [roadmap](../roadmap.md) e depende de decisão comercial sobre este documento.
>
> **Status:** proposta · **Data:** 2026-07-24 · **Base:**
> [`custo-por-tenant.md`](../infrastructure/custo-por-tenant.md) · §4 de
> [`navix-evolucao-estrategica.md`](./navix-evolucao-estrategica.md)

---

## 0. Calibração honesta (leia antes dos preços)

Um documento de preço que confunde "o que existe" com "o que está no roadmap" leva a
vender o que não se pode entregar. Por isso, toda feature abaixo carrega um marcador:

| Marcador | Significado |
|----------|-------------|
| ✅ | **Existe e está exposto** hoje (endpoint/tela em produção no código) |
| 🟡 | Existe **parcialmente** (base pronta, falta acabamento ou exposição) |
| ⬜ | **Roadmap.** Não vender como disponível; serve para ancorar o tier superior |
| ⛔ | **Número não confiável até o teste de carga (T1.2)** |

### Duas correções de premissa

**1. O custo de mapas hoje NÃO está mitigado.** O
[`custo-por-tenant.md`](../infrastructure/custo-por-tenant.md) afirmava que a chamada
ao provedor de mapas era "mitigada pelo cache de matriz por geohash — já na
arquitetura". **Não era verdade:** não há cache no `MapboxRoutingProvider` nem
qualquer uso de geohash no código (a palavra só aparece em documentação). O cache é
escopo previsto da Fase 1 do roadmap, nunca implementado. Enquanto não existir, cada
otimização com `MAPS_PROVIDER=mapbox` paga chamada cheia — o que muda a conta do tier
que promete precisão de trânsito real.

> O documento de custo **já foi corrigido** (o cache virou uma ação pendente lá).
> Este parágrafo fica como registro da premissa que sustentava o modelo anterior.

**2. O default do produto é gratuito em mapas.** `MAPS_PROVIDER` tem default
`haversine` (cálculo geométrico local, custo externo **zero**). O Mapbox é opt-in.
Isso não é um detalhe técnico: é a **alavanca de tiering mais limpa que temos** —
distância geométrica para o tier barato, malha viária/trânsito real para os pagos.

---

## 1. Princípio: cobrar pelo valor que só a Navix cria

Herdado do §4 da estratégia: **não cobramos por assento genérico.** Cobramos por
economia comprovada (km/tempo poupados) e por inteligência. Consequências práticas:

- O tier do autônomo é **barato de propósito**: ele financia o *flywheel* de dados
  (tempos de parada, trânsito real, insights coletivos) que torna os tiers de cima
  defensáveis. Ele é aquisição e matéria-prima, não centro de lucro.
- O que separa os tiers é **precisão e automação**, não limite artificial de cliques.
- Recursos com custo marginal real (mapas, retenção de dados, mídia) entram como
  **limite explícito** por plano — senão a margem some sem ninguém perceber.

---

## 2. Os três planos

### 2.1 Autônomo (self-service)

**Para quem:** motorista individual / MEI que hoje improvisa com papel e Google Maps.
**Aquisição:** cartão, sem vendedor. **Fase 4 do roadmap** para o self-service completo.

| Incluso | Estado |
|---------|--------|
| Importar entregas por CSV (Import Center) | ✅ |
| **Rota preparada automaticamente pela IA** na importação (ADR-0074) | ✅ |
| Grupos Inteligentes (paradas agregadas por tipo de destino, ADR-0075) | ✅ |
| Reorganizar Rota — IA (recomendado) ou ordem manual (ADR-0078) | ✅ |
| App do motorista: Minha Rota, navegação por parada | ✅ |
| **POD**: foto + assinatura + GPS, com fila offline | ✅ |
| Ganhos e Jornada | ✅ |
| Veículo e Manutenção | ✅ |
| Rastreamento da própria posição | ✅ |
| App em 5 locales (pt-BR, pt-PT, en, es) | ✅ |
| Otimização por **distância geométrica** (`haversine`) | ✅ |

**Limites que protegem a margem:** otimizações/dia, entregas/mês, retenção de posições
(hoje `TRACKING_RETENTION_DAYS=90`) e volume de mídia POD. ⛔ Os **valores** desses
limites dependem da T1.2.

---

### 2.2 Frota (o plano principal)

**Para quem:** transportadora com 5–50 veículos e um despachante. É onde está a receita.

Tudo do Autônomo, mais:

| Incluso | Estado |
|---------|--------|
| Rastreamento **da frota** ao vivo (posições de todos os motoristas) | ✅ |
| Tempo real por **SSE** (painel atualiza sozinho, autenticado por ticket) | ✅ |
| Ingestão em lote de posições (descarga da fila offline) | ✅ |
| Restrições reais: capacidade, prioridade/SLA, perfis de veículo, zonas de risco | ✅ |
| Particionamento de entregas entre veículos (`fleet-partitioner`) | ✅ |
| Inteligência operacional: previsão de rota, plano de carga, risco de atraso, estacionamento, combustível | ✅ |
| **Inteligência Coletiva** (insights agregados entre motoristas) | ✅ |
| Comando de voz do motorista | ✅ |
| Papéis e permissões (admin / despachante / gestor de frota / motorista) | ✅ |
| Otimização com **malha viária real** (`MAPS_PROVIDER=mapbox`) | ✅ (opt-in) |
| Convite de motorista pela empresa (multi-usuário) | ⬜ §3.4 |
| Dashboards e KPIs de eficiência por read model (CQRS) | ⬜ §3.2 / Fase 2 |
| Reotimização dinâmica em tempo real | ⬜ Fase 2 |
| Rastreamento público + notificação ao destinatário (CX B2B2C) | ⬜ §3.1 |

> ⚠️ Hoje o convite de motorista **não existe** — a empresa não consegue vincular
> motoristas sozinha. Enquanto isso não for entregue, o plano Frota exige
> provisionamento assistido. **Isso é um bloqueador de venda self-service deste tier**,
> não um detalhe.

---

### 2.3 Enterprise

**Para quem:** operação grande, contrato anual, exigências de conformidade e SLA.

Tudo do Frota, mais:

| Incluso | Estado |
|---------|--------|
| Multi-tenant com isolamento por RLS + trilha de auditoria | ✅ (base) |
| Residência de dados na UE (Frankfurt), GDPR/LGPD | ✅ (arquitetura) |
| **SLA contratual** com uptime e latência | ⛔ depende da T1.2 |
| API pública + Webhooks (integração com ERP/e-commerce) | ⬜ §4.3 |
| White-label: domínio próprio, marca | ⬜ §4.4 |
| SSO / SAML | ⬜ §4.4 |
| ML de ETA e previsão de demanda por tenant | ⬜ Fase 3 |
| Multi-região / residência por jurisdição | ⬜ Fase 4 |
| Retenção estendida e exportação de dados | 🟡 (retenção é configurável; exportação não existe) |

> **Não prometa SLA numérico antes da T1.2.** Um SLA é um compromisso contratual sobre
> capacidade que ainda não medimos — e o teste de restore do DR também nunca foi
> executado (runbook §4 em branco), então RTO/RTO seguem sendo *intenção*.

---

## 3. Direcionadores de custo (ligados ao código real)

Os quatro do `custo-por-tenant.md`, agora com a alavanca de configuração de cada um:

| # | Direcionador | O que consome | Alavanca real no código |
|---|--------------|---------------|--------------------------|
| 1 | **Otimizações/dia** | CPU do worker dedicado | `OPTIMIZER_QUEUE_DRIVER`, nº de workers, tamanho da rota (paradas) |
| 2 | **Posições ingeridas** | escrita + storage no Postgres/TimescaleDB | `TRACKING_RETENTION_DAYS` (default 90), frequência de envio do app |
| 3 | **Chamadas de mapa** | custo externo por request | `MAPS_PROVIDER` (`haversine` = €0 · `mapbox` = pago). **Sem cache hoje** |
| 4 | **Mídia de POD** | storage S3 + transferência | nº de entregas × (foto + assinatura), `MEDIA_URL_TTL_SECONDS` |

**Custo fixo da plataforma** (não varia com o nº de clientes), do `custo-por-tenant.md`:
**€280–420/mês** em AWS Frankfurt de produção — ou €25–70/mês no piloto
(Neon+Render+Upstash), que valida produto mas não sustenta SLA.

---

## 4. Fórmula de margem por tenant

```
custo_tenant  =  custo_fixo / N_tenants
              +  otimizacoes_mes    × c_otim
              +  posicoes_mes       × c_posicao
              +  chamadas_mapa_mes  × c_mapa
              +  gb_pod_armazenado  × c_storage

margem_bruta  =  preco_plano − custo_tenant
margem_%      =  margem_bruta / preco_plano
```

Onde `c_*` são os custos unitários — **todos ⛔ pendentes da T1.2**.

**A dinâmica que importa:** a parcela `custo_fixo / N_tenants` domina no começo e
despenca com escala. Com 10 tenants, o fixo sozinho é €28–42/tenant/mês; com 200, cai
para €1,40–2,10. Ou seja: **nos primeiros clientes, a margem vem da escala futura, não
do preço**. Precificar olhando só o custo de hoje leva a preço alto demais para
adquirir os clientes que baixariam o custo.

### Regras de decisão

1. **Piso:** nenhum plano abaixo do seu `custo_variável` — vender abaixo do marginal
   piora com volume.
2. **Alvo:** margem bruta ≥ **70%** no estado estável (referência SaaS), medida com o
   fixo já diluído por `N` realista de 12 meses.
3. **Tier do autônomo pode operar perto do custo** — desde que a margem consolidada da
   carteira feche. Ele é aquisição e matéria-prima do flywheel (§1).
4. **Mapbox é custo repassável:** se um tier promete trânsito real, ou o preço absorve
   a chamada, ou existe limite explícito. Enquanto não houver cache, é o direcionador
   com maior risco de estourar a margem.

---

## 5. O que depende do teste de carga (T1.2) — explícito

Nada abaixo tem número confiável hoje. Rodar o
[`load-tests/k6/mixed.js`](../../load-tests/k6/mixed.js) **após** o worker dedicado
estar de pé ([worker-dedicado.md](../infrastructure/worker-dedicado.md)) é o que
converte cada item de estimativa em fato:

| ⛔ Item | O que a T1.2 entrega |
|---------|----------------------|
| `c_otim` — custo por 1.000 otimizações | CPU/tempo por otimização sob concorrência real |
| `c_posicao` — custo por 1M de posições | throughput de ingestão e ponto de saturação |
| Limites por plano (otimizações/dia, posições/mês) | o teto que um tenant pode consumir sem degradar os vizinhos |
| Preço final de cada tier | margem só fecha com `c_*` medido |
| **SLA numérico** (uptime, latência de otimização) | p50/p95/p99 e o degrau em que o sistema satura |
| Nº de tenants por unidade de infraestrutura | densidade → a curva `custo_fixo / N` |

> **Consequência prática:** este documento define **estrutura de planos e fórmula** —
> que já dá para negociar e validar com clientes. **Não define preço final.** Publicar
> tabela de preços antes da T1.2 é cravar margem no escuro.

---

## 6. Riscos e decisões em aberto

| # | Risco / questão | Encaminhamento |
|---|-----------------|----------------|
| P1 | Custo de mapa sem cache pode inviabilizar o tier com trânsito real | Implementar o cache de matriz (escopo já previsto na Fase 1) **antes** de vender o tier |
| P2 | Frota não tem convite de motorista → sem self-service | §3.4 vira pré-requisito comercial do tier, não "nice to have" |
| P3 | Preço ancorado em custo, não em valor | Medir km/tempo economizado por cliente-piloto: é o argumento de preço real |
| P4 | Enterprise exige SLA que ainda não podemos sustentar | T1.2 + teste de restore do DR antes de qualquer compromisso contratual |
| P5 | Sem cost allocation tags, não há custo por tenant observável | Ação já listada no `custo-por-tenant.md`; fazer junto com a T1.2 |
| P6 | Limites por plano não são aplicáveis sem enforcement | Billing/quotas é Fase 4; até lá os limites são contratuais, não técnicos |

---

## 7. Próximos passos

1. **Validar a estrutura de tiers** (esta proposta) com o fundador — o que entra em cada plano.
2. **Rodar a T1.2** com o worker dedicado de pé → obter `c_otim` e `c_posicao`.
3. **Ligar cost allocation tags** e medir um tenant real por 30 dias.
4. **Cravar preços** com margem calculada, e só então publicar tabela.
5. **Billing/self-service** (Fase 4) — implementação, fora do escopo desta T1.4.
