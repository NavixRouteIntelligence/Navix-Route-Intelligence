# SLA — Reotimização dinâmica

> **O que é:** o compromisso de latência da reotimização dinâmica (ADR-0083) e
> como medi-lo. Cobre o caminho **evento → rota nova**, não a otimização manual.
>
> **Status:** v1 · **Aplica-se a:** planos com reotimização dinâmica (premium).

---

## 1. O relógio: de quando até quando

O que o cliente sente é: *"mudou alguma coisa — quanto tempo até a rota do
motorista refletir isso?"*. O relógio começa no **fato**, não no processamento:

```
[evento de domínio]                                    ← início do SLA
   ├─ A. debounce (coalesce a rajada)
   ├─ B. gate de plano + leitura das entregas ativas
   ├─ C. espera na fila (BullMQ)
   └─ D. solve + persistência do plano
[plano novo disponível]                                ← fim do SLA
```

## 2. Orçamento por segmento

| # | Segmento | Alvo (p95) | Instrumentado? |
|---|----------|-----------|----------------|
| A+B | evento → job enfileirado | **≤ 5s** | ✅ `optimizer_reoptimization_trigger_seconds` |
| C | espera na fila | ≤ 10s | ⬜ **não** (ver §4) |
| D | solve + persistência | ≤ 5s | ✅ `optimizer_solve_duration_seconds` |
| **Total** | **evento → rota nova** | **≤ 20s** | 🟡 parcial |

O debounce (`OPTIMIZER_REOPTIMIZE_DEBOUNCE_MS`, default 2s) é o maior
componente controlável de A e entra **de propósito** no orçamento: coalescer uma
rajada de import em massa num único job vale mais que economizar 2s.

> **Atraso é diferente.** Para o gatilho de atraso, some o intervalo de
> verificação (`OPTIMIZER_DELAY_CHECK_INTERVAL_MS`, default 60s): no pior caso o
> atraso demora um ciclo para ser notado. **SLA do gatilho de atraso: ≤ 80s.**
> Reduzir o intervalo aproxima da detecção imediata ao custo de ler o plano com
> mais frequência.

## 3. Como medir

```promql
# A+B — evento até enfileirar (p95)
histogram_quantile(0.95, sum(rate(optimizer_reoptimization_trigger_seconds_bucket[5m])) by (le))

# D — solve (p95)
histogram_quantile(0.95, sum(rate(optimizer_solve_duration_seconds_bucket[5m])) by (le))

# Reotimizações barradas pelo plano (esperado > 0 se há tenants free)
sum(rate(optimizer_reoptimization_skipped_total[5m])) by (reason)
```

O `trigger_seconds` mede a partir do **primeiro** evento da rajada — reagendar o
debounce não zera o relógio, senão o número mediria menos do que o cliente
espera. Há teste para isso.

## 4. O que ainda não é medido (honestamente)

**A espera na fila (C) não está instrumentada.** Sem ela, o total de 20s é um
orçamento, não uma medição. Fechar exige expor as métricas do BullMQ (tempo
entre `add` e `active`) — é o próximo passo natural, e barato, já que a fila já
está em produção.

**Nenhum destes números foi observado sob carga.** Os alvos vêm do orçamento de
arquitetura, não de medição: rodar o `load-tests/k6/mixed.js` **com o worker
dedicado de pé** é o que os transforma em fato. Até lá, trate-os como
compromisso interno — **não como SLA contratual** (ver o risco P4 em
[pricing-navix.md](../strategy/pricing-navix.md)).

## 5. Quando o SLA não se aplica

- **Tenant sem plano premium** — o evento chega, nada é enfileirado (por desenho).
- **Menos de 2 paradas ativas** — não há rota a otimizar; o caso de uso é no-op.
- **`OPTIMIZER_AUTO_REOPTIMIZE=false`** — interruptor mestre desligado.
- **Múltiplas réplicas da API** — o `DomainEventBus` é in-process: um evento
  publicado numa réplica **não** chega às outras. Com o worker dedicado ativo
  (ADR-0081) isto já vale hoje. Ver a pendência no ADR-0083.
