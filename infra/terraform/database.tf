# ---------------------------------------------------------------------------
# Banco de dados: RDS PostgreSQL 16 (PostGIS + TimescaleDB habilitáveis).
# Backup automático + point-in-time restore ligados (fecha parte do R2).
# ---------------------------------------------------------------------------

resource "random_password" "db_master" {
  length  = 32
  special = false # evita caracteres problemáticos em connection strings
}

resource "aws_db_subnet_group" "this" {
  name       = "${local.name}-db"
  subnet_ids = module.vpc.database_subnets
}

# Parâmetros do Postgres: pré-carrega bibliotecas de PostGIS/TimescaleDB.
resource "aws_db_parameter_group" "this" {
  name_prefix = "${local.name}-pg16-"
  family      = "postgres16"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements,timescaledb"
    apply_method = "pending-reboot"
  }
  lifecycle { create_before_destroy = true }
}

resource "aws_db_instance" "this" {
  identifier     = "${local.name}-pg"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 4 # autoscaling de disco
  storage_type          = "gp3"
  storage_encrypted     = true # criptografia em repouso (segurança + LGPD/GDPR)

  db_name  = "navix"
  username = "navix_admin"
  password = random_password.db_master.result

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [aws_security_group.data.id]
  parameter_group_name   = aws_db_parameter_group.this.name
  multi_az               = var.db_multi_az

  # --- Continuidade (R2) ---
  backup_retention_period   = var.db_backup_retention_days
  backup_window             = "02:00-03:00"
  maintenance_window        = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = "${local.name}-pg-final"

  # --- Observabilidade ---
  performance_insights_enabled = true
  enabled_cloudwatch_logs_exports = ["postgresql"]

  lifecycle {
    ignore_changes = [password] # rotacione via Secrets Manager, não pelo TF
  }
}

# NOTA: depois do primeiro boot, conecte-se e rode uma vez:
#   CREATE EXTENSION IF NOT EXISTS postgis;
#   CREATE EXTENSION IF NOT EXISTS timescaledb;
#   CREATE EXTENSION IF NOT EXISTS pgcrypto;
# E crie o role de aplicação NOSUPERUSER NOBYPASSRLS (a RLS multi-tenant depende
# disso — ver docs/security.md). O pipeline de migração cuida do schema.
