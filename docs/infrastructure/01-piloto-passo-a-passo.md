# Piloto — Passo a Passo (para colocar a Navix no ar hoje)

> **Objetivo:** com este guia, um fundador não-técnico coloca a Navix no ar em ~1 dia,
> tudo em região da **União Europeia (Frankfurt)**, atendendo Portugal e Brasil.
> Você não digita comando nenhum — é tudo por site e cliques.
>
> **Tenha à mão:** um cartão de crédito, acesso ao GitHub do projeto e ~2 a 3 horas.
> Guarde **todas as senhas** que criar num gerenciador (ex.: 1Password/Bitwarden).

---

## Antes de começar — o "cofre de senhas"

Ao longo do caminho você vai gerar alguns segredos (senhas de banco, chaves). Crie
uma nota segura com estes campos em branco; vamos preenchendo:

```
DB_URL          = (Neon)
REDIS_URL       = (Upstash)
JWT_PRIVATE_KEY = (gerado no passo 5)
JWT_PUBLIC_KEY  = (gerado no passo 5)
ENCRYPTION_KEK  = (gerado no passo 5)
R2_ACCESS_KEY   = (Cloudflare R2)
R2_SECRET_KEY   = (Cloudflare R2)
```

> ⚠️ **Nunca** cole esses valores em e-mail, chat ou no código. Eles vão só nos
> "Environment / Secrets" de cada serviço, como o guia indica.

---

## Passo 1 — Banco de dados (Neon)

1. Acesse **neon.com** e crie a conta (pode entrar com o GitHub).
2. **Create project.** Nome: `navix`. **Região: Europe (Frankfurt)** — isto é
   obrigatório para a decisão de GDPR.
3. Na tela do projeto, abra **SQL Editor** e rode, uma vez, para ligar as extensões
   que o projeto usa:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```
4. Vá em **Connection Details** → copie a **Connection string** (começa com
   `postgresql://...`). Cole no cofre em `DB_URL`.

✅ Pronto. O Neon já faz **backup automático** com "point-in-time restore" (voltar o
banco a um minuto específico) — isso já resolve parte do plano de desastre.

---

## Passo 2 — Memória rápida / Redis (Upstash)

1. Acesse **upstash.com**, crie a conta.
2. **Create Database** (Redis). Nome: `navix`. **Região: EU (Frankfurt ou Ireland)**.
3. Copie a **connection string** que começa com `rediss://...` (com dois "s" — é a
   versão criptografada). Cole no cofre em `REDIS_URL`.

---

## Passo 3 — Guardar as fotos das entregas (Cloudflare R2)

1. Acesse **dash.cloudflare.com**, crie a conta.
2. Menu **R2** → **Create bucket**. Nome: `navix-pod`. Região: **Automatic (EU)**.
3. **Manage R2 API Tokens** → **Create API token** (permissão de leitura e escrita
   nesse bucket). Copie **Access Key** e **Secret Key** para o cofre
   (`R2_ACCESS_KEY`, `R2_SECRET_KEY`). Anote também o "endpoint" que aparece.

---

## Passo 4 — Aplicação: API + trabalhador + web (Render)

O código já está no GitHub; o Render pega de lá e sobe. Vamos criar **3 serviços**.

1. Acesse **render.com**, crie a conta e clique **New +** → **Blueprint** (ele lê um
   arquivo `render.yaml` do repositório — já deixei um pronto em
   `infra/render/render.yaml`). Se preferir criar à mão, siga abaixo.
2. **Região: Frankfurt (EU Central)** em todos os serviços.
3. **Serviço 1 — API** (`New + → Web Service`):
   - Repositório: o da Navix. **Dockerfile:** `docker/api.Dockerfile`.
   - Depois de criado, abra **Environment** e cole as variáveis (nomes idênticos aos
     do `.env.example` do projeto):
     - `NODE_ENV = production`
     - `DATABASE_URL = ` (o `DB_URL` do cofre)
     - `REDIS_URL = ` (o `REDIS_URL` do cofre)
     - `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `ENCRYPTION_KEK` (do passo 5)
     - `STORAGE_DRIVER = s3`, e as chaves do R2 (passo 3)
     - `OPTIMIZER_WORKER_ENABLED = false` (nesta API; quem processa é o serviço 2)
4. **Serviço 2 — Trabalhador de rotas** (`New + → Background Worker`):
   - Mesmo repositório e Dockerfile da API, mas **Start Command** apontando para o
     worker (`node dist/main-worker.js`) e `OPTIMIZER_WORKER_ENABLED = true`.
   - Cole as **mesmas** variáveis de ambiente da API.
   - _Por que separado?_ Calcular rota é pesado; se rodasse junto da API, travaria o
     app dos outros clientes. (É o risco R3 da auditoria, já resolvido no código.)
5. **Serviço 3 — Web (painel)** (`New + → Web Service`):
   - **Dockerfile:** `docker/web.Dockerfile`.
   - Variável: `NEXT_PUBLIC_API_BASE_URL = https://api.navix.pt` (ou o domínio que
     você escolher no guia de domínios).

> A cada vez que você (ou eu) fizer uma mudança no código e enviar ao GitHub, o Render
> **atualiza sozinho**. Esse é o "deploy automático" que faltava no R2.

---

## Passo 5 — Gerar as chaves de segurança (uma vez)

A API precisa de um par de chaves (para os "crachás" de login) e de uma chave de
criptografia. **Se faltarem, a aplicação nem liga** — isso é proposital (risco R5 da
auditoria, já corrigido). Para gerá-las sem instalar nada:

1. Acesse **cryptotools.net/rsagen** (ou peça para mim gerar) e crie um par RSA de
   **2048 bits**. Cole a chave privada em `JWT_PRIVATE_KEY` e a pública em
   `JWT_PUBLIC_KEY`.
2. Para o `ENCRYPTION_KEK`, gere uma senha aleatória de 32 caracteres num gerenciador
   de senhas e cole no cofre.
3. Leve esses três valores para os **Environment** dos serviços 1 e 2 no Render.

> 💡 Se preferir, me peça: **"gera as chaves para mim"** e eu produzo os três valores
> prontos para colar (você só precisa guardá-los no cofre).

---

## Passo 6 — Rodar as migrações (montar as tabelas do banco)

O banco está vazio; precisa criar as tabelas uma vez.

- No Render, no **Serviço 1 (API)**, abra a aba **Shell** e rode:
  ```
  npm run migration:run
  ```
- Se aparecer "migrations executed", está feito. (Se preferir, me chame e eu te guio
  ou rodo via um job.)

---

## Passo 7 — Ligar os domínios

Siga [`02-dominios.md`](./02-dominios.md) para apontar `api.navix.pt`,
`app.navix.pt` etc. para os serviços do Render. Leva ~10 minutos + tempo de
propagação.

---

## Passo 8 — Conferir se está tudo no ar

1. Abra `https://api.navix.pt/api/v1/health` — deve responder algo como `{"status":"ok"}`.
2. Abra `https://app.navix.pt` — deve carregar a tela de login.
3. Registre uma empresa de teste e faça login.
4. No app mobile (Flutter), aponte para `https://api.navix.pt` e teste um login.

✅ **No ar.** Você tem a Navix rodando para Portugal e Brasil, em região da UE, com
deploy automático e backup de banco. O piloto está de pé.

---

## Se algo der errado

- **A API não sobe:** quase sempre é uma variável de ambiente faltando (veja o log no
  Render; ele diz qual). Confira `DATABASE_URL`, `REDIS_URL` e as três chaves do passo 5.
- **Login "cai" sozinho:** as chaves JWT estão diferentes entre a API e o worker.
  Elas têm que ser **idênticas** nos dois serviços.
- **Qualquer dúvida:** me chame aqui descrevendo a tela/erro e eu te destravo.

---

## Próximo nível (quando o piloto validar)

Migrar para a **AWS Frankfurt** usando a planta em `infra/terraform/` — mais robusto,
com alta disponibilidade e pronto para milhares de clientes. Nada do que você fez aqui
é jogado fora: as mesmas variáveis e o mesmo código continuam valendo.
