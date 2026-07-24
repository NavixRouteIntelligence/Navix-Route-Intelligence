# Topologia — worker dedicado de otimização

> **O que muda:** a otimização de rotas sai de dentro do processo da API e passa
> a rodar num processo próprio (`navix-worker`), consumindo uma fila durável no
> Redis. Fecha o **R3** da auditoria (a otimização travando a API).
>
> **Base:** ADR-0055 (fila BullMQ) · **Correções de ativação:** ADR-0081.

---

## 1. Por que

O solver é o caminho mais caro em CPU do produto. Rodando dentro da API, ele
disputa o event loop com o tráfego HTTP: uma otimização grande degrada **todas**
as requisições em curso (é o que o alerta `NavixApiEventLoopLag` detecta). Além
disso a fila in-process não é durável — um restart perde o que estava agendado.

Com o worker dedicado:

| | API (`navix-api`) | Worker (`navix-worker`) |
|---|---|---|
| Faz | atende HTTP e **enfileira** | **consome** a fila e processa |
| Otimiza? | não | sim |
| Escala por | tráfego | volume de otimizações |

---

## 2. As duas variáveis (e por que ambas importam)

```bash
OPTIMIZER_QUEUE_DRIVER=bullmq        # onde o job é enfileirado
OPTIMIZER_WORKER_ENABLED=true|false  # este processo consome a fila?
```

| Processo | `QUEUE_DRIVER` | `WORKER_ENABLED` |
|----------|----------------|------------------|
| `navix-api` | `bullmq` | `false` |
| `navix-worker` | `bullmq` | `true` |

> ⚠️ **A pegadinha que já nos mordeu.** `WORKER_ENABLED=false` **sozinho não
> tira a otimização da API**: essa variável governa apenas o worker BullMQ. Com
> `QUEUE_DRIVER` no default (`inprocess`), a fila in-process processa dentro do
> próprio processo da API — e o worker dedicado fica ocioso consumindo uma fila
> vazia. A topologia vira um no-op silencioso: tudo "funciona", e a otimização
> continua exatamente onde não deveria estar. **As duas variáveis andam juntas.**

O entrypoint do worker é `apps/api/dist/main-worker.js` (o WORKDIR da imagem é
`/repo`). Ele sobe o mesmo `AppModule` como *application context* — mesmo grafo
de DI, sem servidor HTTP, sem controllers atendendo.

---

## 3. Garantias

**Idempotência.** O `jobId` do domínio é usado como id do job no BullMQ, então
reenfileirar o mesmo job (reotimização, retry do request) não duplica o
processamento — o BullMQ deduplica pelo id.

**Restart não perde job.** O job vive no Redis, não na memória do processo:

- *Reinício da API* — o job já está no Redis; o worker o consome quando voltar.
- *Reinício do worker* — `SIGTERM` fecha o `Worker` drenando o job em curso
  (`app.close()` → `onModuleDestroy`).
- *Crash do worker* — o BullMQ detecta o job travado (*stalled*) e o redelivera.
  Na retomada o worker chama `resetForRetry`, que devolve o job de `running` para
  `queued` — sem isso o `claim` barraria o reprocessamento.
- *Redis fora no momento de enfileirar* — o `enqueue` **rejeita**, a exceção sobe
  e a transação do request desfaz o job recém-criado. O cliente recebe o erro na
  hora, em vez de um `202` com um `jobId` eternamente `queued` (ADR-0081).

**Retry/backoff.** `OPTIMIZER_JOB_ATTEMPTS` (default 3) tentativas com backoff
exponencial a partir de `OPTIMIZER_JOB_BACKOFF_MS` (default 1000ms).

**RLS preservada.** O `tenantId` viaja dentro do job. O worker abre a transação
com `app.current_tenant` antes de processar, espelhando o
`TenantTransactionInterceptor` — ele nunca varre o banco entre tenants.

---

## 4. Como reverter para `inprocess`

A troca é por configuração; **não há mudança de código nem migração**.

1. Na API, remova ou troque a variável:
   ```bash
   OPTIMIZER_QUEUE_DRIVER=inprocess
   ```
2. Desligue o serviço `navix-worker` (no Render: *Suspend*; no ECS:
   `worker_desired_count = 0`).
3. Reimplante a API.

O que muda ao reverter: volta a valer o comportamento anterior — a otimização
roda no processo da API e a fila **deixa de ser durável** (jobs agendados se
perdem num restart, e não há retry/redelivery). É aceitável em piloto e em
desenvolvimento; não é aceitável sob carga (ADR-0007/0055).

> Jobs que já estavam no Redis quando você reverteu **não** serão processados
> enquanto não houver um consumidor. Suspenda o worker só com a fila vazia, ou
> religue-o depois para drenar.

---

## 5. Onde está configurado

| Alvo | Arquivo |
|------|---------|
| Render (piloto) | `infra/render/render.yaml` — serviços `navix-api` e `navix-worker` |
| AWS Fargate (GA) | `infra/terraform/ecs.tf` — serviços `api` e `worker` |

---

## 6. Como verificar que está mesmo separado

1. No boot do worker, o log deve trazer `Worker de otimização ativo (BullMQ).`
   Se não aparecer, `QUEUE_DRIVER` não é `bullmq` ou `WORKER_ENABLED` não é `true`.
2. Dispare uma otimização e acompanhe: o job sai de `queued` sem que a API
   consuma CPU de solver (o `NavixApiEventLoopLag` fica quieto).
3. Só então rode o `load-tests/k6/mixed.js` — ele **pressupõe** esta topologia;
   rodado com a fila in-process, mede outra arquitetura.
