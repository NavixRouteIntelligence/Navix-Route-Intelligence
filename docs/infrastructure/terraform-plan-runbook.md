# Runbook — `terraform plan` limpo em eu-central-1

> **O que é:** o passo a passo para sair de "a planta está válida" para "um `terraform
> plan` reproduzível e revisável" na conta AWS de Frankfurt. Fecha a parte do **R2**
> que exige um caminho de provisionamento determinístico.
>
> **Status:** v1 · **Pré-requisito:** a planta em `infra/terraform/` (já passa em
> `terraform fmt -check` e `terraform validate` — ver o job `infra` da CI).

> ⚠️ **Este runbook vai só até o `plan`.** O `apply` em produção depende de aprovação
> humana da saída do `plan` (ver §6). Nunca aplique às cegas.

---

## 0. Pré-requisitos (uma vez)

| Item | Como |
|------|------|
| Terraform ≥ 1.6 | `brew install hashicorp/tap/terraform` (validado com 1.15.8) |
| AWS CLI autenticado | `aws configure sso` (recomendado) ou credenciais de uma role com permissão de admin **na conta certa** |
| Região | `eu-central-1` (Frankfurt) — residência de dados UE |
| Identidade confirmada | `aws sts get-caller-identity` mostra a **conta esperada** antes de qualquer comando |

> O `plan` **precisa de credenciais**: ele lê data sources reais (ex.:
> `aws_availability_zones`) e o estado remoto. Não existe `plan` "de verdade" offline —
> o que a CI faz (`init -backend=false` + `validate`) cobre sintaxe/formatação, não o
> diff contra a conta.

---

## 1. Bootstrap do estado remoto (uma vez, antes do primeiro `init` com backend)

O bloco `backend "s3"` em `versions.tf` está **comentado** de propósito: o bucket de
state e a tabela de lock precisam existir **antes**. Crie-os uma vez, à mão:

```bash
# Bucket de state (versionado + criptografado + bloqueio de acesso público)
aws s3api create-bucket \
  --bucket navix-tfstate \
  --region eu-central-1 \
  --create-bucket-configuration LocationConstraint=eu-central-1
aws s3api put-bucket-versioning \
  --bucket navix-tfstate --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket navix-tfstate \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"aws:kms"}}]}'
aws s3api put-public-access-block --bucket navix-tfstate \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Tabela de lock (evita dois applies concorrentes corromperem o state)
aws dynamodb create-table \
  --table-name navix-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region eu-central-1
```

Depois **descomente** o bloco `backend "s3"` em `versions.tf` e rode `terraform init`
(sem `-backend=false`), que migra o state para o S3.

> Enquanto o backend fica comentado, o state é **local** (`terraform.tfstate` no
> diretório) — bom para um primeiro `plan` exploratório, **ruim** para trabalho em
> equipe. Não faça `apply` de produção com state local.

---

## 2. Escolha do ambiente

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars   # NÃO versione o arquivo real
```

Ajuste `terraform.tfvars`:

- `environment = "staging"` para o primeiro exercício (barato, 1 NAT, sem multi-AZ).
- `environment = "production"` liga HA: multi-AZ no banco/Redis, 1 NAT por AZ,
  `deletion_protection`. Lembre de `db_multi_az = true`.
- `domain_name` vazio (`""`) enquanto não houver domínio — o certificado ACM e a regra
  de host do ALB ficam desativados por `count` (a planta continua válida).

---

## 3. `init` + `plan`

```bash
terraform init                 # com backend S3 já descomentado (§1)
terraform plan -out=tfplan     # revise TODO o diff; salve o plano
```

Leia a saída procurando por: nº de recursos a criar, nomes de bucket S3 (globais —
colisão aborta), e se algum recurso aparece como **replace** inesperado.

---

## 4. O ovo-e-galinha da imagem do ECR (apply em duas fases)

As task definitions do ECS referenciam `var.api_image` / `var.web_image`, que ficam
**vazias** até o pipeline publicar a primeira imagem — mas o repositório ECR é criado
**pelo próprio Terraform**. Num primeiro `apply` do zero, isso é um ciclo: não há
imagem para a task def porque o ECR ainda não existe.

**Resolução determinística (recomendada) — apply em duas fases:**

```bash
# Fase 1: cria só o registro de imagens (e o que ele depende).
terraform apply -target=aws_ecr_repository.api -target=aws_ecr_repository.web

# Publique uma imagem (localmente ou disparando o CD uma vez):
#   docker build -f docker/api.Dockerfile -t <ecr_api_repo>:bootstrap .
#   docker push <ecr_api_repo>:bootstrap
# e ponha a tag em terraform.tfvars (api_image/web_image) OU deixe o CD assumir.

# Fase 2: aplica o resto.
terraform apply
```

> Ver o **ADR-0079** para o registro dessa decisão de ordenação. Alternativa
> (placeholder público como default das variáveis de imagem) foi considerada e
> **rejeitada** para não subir container que falha o healthcheck em produção.

---

## 5. Validação do certificado (DNS externo no Cloudflare)

O `aws_acm_certificate` usa **validação por DNS**, mas o DNS mora no **Cloudflare**
(não há `aws_route53_record` na planta de propósito). Após o `apply` que cria o
certificado:

1. Pegue os registros CNAME de validação (console do ACM ou
   `terraform state show aws_acm_certificate.this[0]`).
2. Crie-os no Cloudflare (ver [`02-dominios.md`](./02-dominios.md)).
3. O listener HTTPS só serve tráfego quando o certificado sai de *Pending* para
   *Issued*. Não há `aws_acm_certificate_validation` na planta — a espera é manual.

---

## 6. Do `plan` aprovado ao `apply` (com aprovação humana)

1. Anexe a saída do `terraform plan` na revisão. **Alguém aprova o diff.**
2. `terraform apply tfplan` (aplica exatamente o plano salvo — sem surpresas).
3. Pós-apply, alimente os **insumos do CD** a partir dos outputs (Settings → Secrets
   and variables → Actions):

   | Fonte (output) | Destino no GitHub Actions |
   |----------------|---------------------------|
   | `private_subnet_ids` | Variable `PRIVATE_SUBNETS` |
   | `app_security_group_id` | Variable `APP_SG` |
   | `ecs_cluster_name` | confere com `ECS_CLUSTER` do `deploy.yml` |
   | (role OIDC de deploy — criada fora desta planta) | Secret `AWS_DEPLOY_ROLE_ARN` |

4. Complete os passos pós-apply do [`README do Terraform`](../../infra/terraform/README.md):
   preencher `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`/`ENCRYPTION_KEK` no Secrets Manager,
   habilitar as extensões do Postgres e criar o role de aplicação
   `NOSUPERUSER NOBYPASSRLS`.

---

## 7. Riscos a confirmar no `plan` real (não pegos por `validate`)

- **TimescaleDB no RDS:** `database.tf` pré-carrega `timescaledb` em
  `shared_preload_libraries`. Confirme que a extensão está na lista suportada do **RDS
  PostgreSQL 16 em eu-central-1** (o piloto usa Neon, que suporta nativamente). Se não
  estiver, o banco não sobe — decida entre Aurora/self-managed ou remover a dependência.
- **Nomes globais de S3:** `${environment}-pod-media` e o bucket de state são globais;
  colisão de nome aborta o `apply`.
- **Cotas da conta:** VPC, EIP (NAT) e Fargate têm limites por conta nova — um `apply`
  pode esbarrar em quota antes de terminar.
