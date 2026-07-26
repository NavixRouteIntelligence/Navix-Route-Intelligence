# ---------------------------------------------------------------------------
# Segredos: guardados no AWS Secrets Manager e injetados nas tarefas ECS.
# NUNCA ficam no código nem em texto plano. As chaves JWT/KEK você gera e
# grava uma vez (ver docs/infrastructure/01-piloto-passo-a-passo.md, passo 5).
#
# IMPORTANTE — o formato segue o contrato do app: a API valida o ambiente com
# Zod no boot (apps/api/src/shared/config/env.schema.ts) e espera as variáveis
# SEPARADAS (DB_HOST, DB_PORT, ...). Ela NÃO lê DATABASE_URL/REDIS_URL: uma
# connection string montada aqui seria simplesmente ignorada e o boot morreria
# em "DB_HOST: Required". Ver ADR-0080.
# ---------------------------------------------------------------------------

# Role de runtime da aplicação (NÃO superusuário, sujeito à RLS — ADR-0012).
# A migração `CreateAppRole` cria este role lendo DB_APP_USER/DB_APP_PASSWORD;
# como a task de migração recebe os mesmos valores daqui, o role criado e o
# usado em runtime são necessariamente o mesmo.
resource "random_password" "db_app" {
  length  = 32
  special = false # evita escaping no CREATE ROLE ... PASSWORD '...'
}

locals {
  # Chaves exatamente como o envSchema as espera. Números e booleanos viram
  # string: variável de ambiente é sempre texto (o Zod faz o coerce).
  app_env_secrets = {
    # --- Postgres ---
    # `address` (host puro), e não `endpoint` — este último traz ":5432" junto,
    # o que entregaria um host inválido ao driver.
    DB_HOST = aws_db_instance.this.address
    DB_PORT = "5432"
    # Sem PgBouncer nesta topologia: a porta direta é a mesma. O default do
    # schema é 6432 (PgBouncer), que aqui não existe.
    DB_DIRECT_PORT = "5432"
    DB_NAME        = aws_db_instance.this.db_name
    # Owner: usado por migrações e seed (bypassa RLS).
    DB_USER     = aws_db_instance.this.username
    DB_PASSWORD = random_password.db_master.result
    # Runtime: sujeito à RLS.
    DB_APP_USER     = "navix_app"
    DB_APP_PASSWORD = random_password.db_app.result
    # `assertProductionConfig` reprova o boot se não for "true" em produção.
    DB_SSL = "true"

    # --- Redis ---
    REDIS_HOST     = aws_elasticache_replication_group.this.primary_endpoint_address
    REDIS_PORT     = "6379"
    REDIS_PASSWORD = random_password.redis_auth.result
  }
}

resource "aws_secretsmanager_secret" "app" {
  name = "${local.name}/app"
}

# Segredos gerenciados pela infra (endereços e credenciais já resolvidos).
resource "aws_secretsmanager_secret_version" "app" {
  secret_id     = aws_secretsmanager_secret.app.id
  secret_string = jsonencode(local.app_env_secrets)
}

# Segredos que VOCÊ preenche à mão no console (uma vez), pois são material
# criptográfico que a infra não deve gerar/versionar. Todos são EXIGIDOS em
# produção por `assertProductionConfig` — sem eles a API derruba o boot de
# propósito: cada instância assinaria com um segredo próprio e rejeitaria os
# tokens/URLs das demais (login intermitente, foto de POD quebrada).
resource "aws_secretsmanager_secret" "app_keys" {
  name = "${local.name}/app-keys"
}

resource "aws_secretsmanager_secret_version" "app_keys_placeholder" {
  secret_id = aws_secretsmanager_secret.app_keys.id
  secret_string = jsonencode({
    JWT_PRIVATE_KEY = "PREENCHER_NO_CONSOLE"
    JWT_PUBLIC_KEY  = "PREENCHER_NO_CONSOLE"
    # Identificador do par de chaves (obrigatório em produção; sustenta rotação).
    JWT_KEY_ID = "PREENCHER_NO_CONSOLE"
    # Assina as URLs de mídia do POD (ADR-0046). Estável entre instâncias.
    MEDIA_URL_SECRET = "PREENCHER_NO_CONSOLE"
    ENCRYPTION_KEK   = "PREENCHER_NO_CONSOLE"
  })
  lifecycle { ignore_changes = [secret_string] } # não sobrescreve o que você colar
}
