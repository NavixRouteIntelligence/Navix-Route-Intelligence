# Infraestrutura da Navix — Guia do Fundador

> **Para quem é este documento:** você, que não é da parte de servidores. Aqui está
> explicado, em português claro, **o que vamos usar, por quê, quanto custa e o que
> fazer** para colocar a Navix no ar e fechar o risco **R2** da auditoria (a
> "operação que ainda não existe").
>
> **Status:** proposta do CTO · **Data:** 2026-07-18 · **Decisão de região:** aprovada

---

## 1. A decisão mais importante: uma região só, na Europa (Frankfurt)

Seus primeiros clientes estão em **Portugal e no Brasil**. A tentação é montar
servidor nos dois lugares. **Não vamos fazer isso agora** — e essa é uma decisão
de engenharia deliberada, não preguiça:

- **A lei não obriga.** A LGPD (Brasil) **não** exige que o dado fique num servidor
  no Brasil. A GDPR (Europa) é a mais rígida das duas. A forma limpa de cumprir as
  duas ao mesmo tempo é **guardar tudo numa região da União Europeia** (Frankfurt) e
  ter uma política de privacidade adequada. Dado europeu na Europa = zero dor de
  cabeça; dado brasileiro na Europa = permitido, com a política certa.
- **A performance aguenta.** O app do motorista é **offline-first** (funciona sem
  internet e sincroniza depois), então a distância até a Europa quase não afeta quem
  está na rua entregando. O painel da empresa sente uns ~200ms a mais no Brasil —
  imperceptível para um piloto. E colocamos o **Cloudflare** na frente, que deixa
  tudo que é imagem/tela rápido nos dois países.
- **Multi-região é a Fase 4.** Montar banco no Brasil *e* na Europa, com o dado de
  cada cliente na sua região, é um projeto grande — e o **roadmap já colocou isso na
  Fase 4 (Escala global)**. Puxar para agora seria inflar o R2 sem necessidade.
  Fazemos quando houver tração real nos dois países; a arquitetura multi-tenant já
  permite "fixar" clientes por região quando chegar a hora.

**Resumo:** _uma_ infraestrutura, em **Frankfurt (UE)**, atende Portugal e Brasil de
forma legal e com boa performance. Multi-região fica para depois.

---

## 2. O que cada peça faz (sem jargão)

A Navix precisa de 6 "peças". Para cada uma, escolhi a melhor opção para o seu caso
(fundador que quer subir já e ficar pronto para o R2):

| Peça | O que é (em português) | Escolhida | Por quê |
|------|------------------------|-----------|---------|
| **Banco de dados** | Onde ficam entregas, rotas, usuários | **Neon** (piloto) → **AWS RDS** (escala) | Únicos que têm PostGIS **e** TimescaleDB, que o projeto exige. Backup automático. |
| **Servidor da aplicação** | Roda o "cérebro" (API) e o "trabalhador" que calcula rotas | **Render** (piloto) → **AWS Fargate** (escala) | Deploy automático a cada mudança de código (isso é o "CD" que falta no R2). |
| **Memória rápida (Redis)** | Fila de tarefas e rastreamento ao vivo | **Upstash** (piloto) → **AWS ElastiCache** | Gerenciado, cobra por uso, barato no início. |
| **Guardar fotos** | Fotos e assinaturas das entregas (POD) | **Cloudflare R2** | Barato, sem taxa de download, já compatível com o código. |
| **Porta de entrada / proteção** | Domínio, DNS, proteção contra ataque, deixa o site rápido | **Cloudflare** | Preço de custo no domínio, e proteção/CDN de graça. |
| **Planta da infraestrutura (IaC)** | O "mapa" que recria tudo com um comando | **Terraform** | É exatamente o que o R2 exige que exista. Já escrito em `infra/terraform/`. |

---

## 3. A estratégia em duas velocidades (o meu favorito para você)

Fazemos as duas coisas ao mesmo tempo, sem retrabalho:

**Velocidade 1 — subir o piloto AGORA (~1 dia, você mesmo consegue).**
Neon + Render + Upstash + Cloudflare, todos em região da UE. Você clica, conecta o
GitHub, e a Navix fica no ar para os primeiros clientes de Portugal e Brasil.
👉 Passo a passo em [`01-piloto-passo-a-passo.md`](./01-piloto-passo-a-passo.md).

**Velocidade 2 — fechar o R2 de verdade (a "planta" já está escrita).**
Em paralelo, deixei prontos no repositório os arquivos que a auditoria diz que não
existem: a **planta da AWS Frankfurt** (`infra/terraform/`), o **deploy automático**
(`.github/workflows/deploy.yml`) e o **plano de desastre**
([`runbook-dr.md`](./runbook-dr.md)). Quando o piloto validar o produto, migrar para
a AWS é aplicar essa planta — sem refazer nada, porque desde já ela mira Frankfurt.

Assim você **não paga a conta duas vezes**: valida rápido e barato, e já tem a base
industrial pronta para escalar.

---

## 4. Quanto custa (estimativa honesta)

Valores aproximados, para você não ser surpreendido. Podem variar com o uso.

**Piloto (Velocidade 1) — ~€25 a €70/mês:**

| Serviço | Plano inicial | Custo/mês aprox. |
|---------|---------------|------------------|
| Neon (banco) | Launch | €15–25 |
| Render (API + worker + web) | 3 serviços pequenos | €15–30 |
| Upstash (Redis) | Pay-as-you-go | €0–10 |
| Cloudflare (DNS/proteção) | Free | €0 |
| Cloudflare R2 (fotos) | Pay-as-you-go | €1–5 |
| **Domínios** | .com + .pt + .com.br (anual) | ~€40/**ano** (~€3/mês) |

**GA / escala (Velocidade 2, AWS Frankfurt) — ~€150 a €300/mês** no começo, subindo
conforme o número de clientes. O custo por cliente é calculado em
[`custo-por-tenant.md`](./custo-por-tenant.md) (o R2 apontava a ausência desse modelo).

> Comparado ao que a plataforma pode faturar por empresa cliente, esses valores são
> pequenos — o gasto de infra só vira relevante lá na frente, com milhares de tenants.

---

## 5. Índice — o que ler e nesta ordem

1. **Você está aqui** (visão geral e decisões).
2. [`01-piloto-passo-a-passo.md`](./01-piloto-passo-a-passo.md) — para colocar no ar hoje.
3. [`02-dominios.md`](./02-dominios.md) — registrar e configurar os domínios.
4. [`runbook-dr.md`](./runbook-dr.md) — o que fazer se algo quebrar (backup/desastre).
5. `infra/terraform/` (na raiz do repo) — a planta da AWS, para o seu futuro devops
   ou para mim aplicar quando formos ao GA.
6. [`custo-por-tenant.md`](./custo-por-tenant.md) — quanto custa cada cliente.

---

## 6. O que este pacote fecha do R2

A auditoria listou o R2 como bloqueador do GA por não existir: IaC, deploy
automatizado, backup testado, DR e runbook. Este pacote entrega:

- ✅ **IaC** — Terraform completo em `infra/terraform/`.
- ✅ **CD (deploy automático)** — `.github/workflows/deploy.yml`.
- ✅ **Backup + restore + DR + rollback** — `runbook-dr.md`.
- ✅ **Modelo de custo por tenant** — `custo-por-tenant.md`.
- ✅ **Ambientes** (staging/produção) — previstos na planta Terraform.

O que **ainda** exige uma pessoa (você) apertando botões: criar as contas (Neon,
Render, Cloudflare, AWS) e colar as senhas nos lugares indicados. Tudo está no passo
a passo, em linguagem de clique.
