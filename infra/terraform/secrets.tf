# ---------------------------------------------------------------------------
# Segredos: guardados no AWS Secrets Manager e injetados nas tarefas ECS.
# NUNCA ficam no código nem em texto plano. As chaves JWT/KEK você gera e
# grava uma vez (ver docs/infrastructure/01-piloto-passo-a-passo.md, passo 5).
# ---------------------------------------------------------------------------

# Monta a connection string do Postgres a partir do RDS criado.
locals {
  database_url = "postgresql://${aws_db_instance.this.username}:${random_password.db_master.result}@${aws_db_instance.this.endpoint}/navix?sslmode=require"
  redis_url    = "rediss://:${random_password.redis_auth.result}@${aws_elasticache_replication_group.this.primary_endpoint_address}:6379"
}

resource "aws_secretsmanager_secret" "app" {
  name = "${local.name}/app"
}

# Segredos gerenciados pela infra (URLs de banco/redis já resolvidas).
resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    DATABASE_URL = local.database_url
    REDIS_URL    = local.redis_url
  })
}

# Segredos que VOCÊ preenche à mão no console (uma vez), pois são material
# criptográfico que a infra não deve gerar/versionar:
#   JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, ENCRYPTION_KEK
# Criamos o "envelope" vazio; o valor é colado no console do Secrets Manager.
resource "aws_secretsmanager_secret" "app_keys" {
  name = "${local.name}/app-keys"
}

resource "aws_secretsmanager_secret_version" "app_keys_placeholder" {
  secret_id     = aws_secretsmanager_secret.app_keys.id
  secret_string = jsonencode({
    JWT_PRIVATE_KEY = "PREENCHER_NO_CONSOLE"
    JWT_PUBLIC_KEY  = "PREENCHER_NO_CONSOLE"
    ENCRYPTION_KEK  = "PREENCHER_NO_CONSOLE"
  })
  lifecycle { ignore_changes = [secret_string] } # não sobrescreve o que você colar
}
