# ---------------------------------------------------------------------------
# Variáveis de entrada. Valores reais em terraform.tfvars (não versionado).
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "Região AWS. Frankfurt para residência de dados na UE."
  type        = string
  default     = "eu-central-1"
}

variable "environment" {
  description = "Ambiente: staging ou production."
  type        = string
  default     = "staging"
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment deve ser 'staging' ou 'production'."
  }
}

variable "vpc_cidr" {
  description = "Bloco de IPs privados da rede."
  type        = string
  default     = "10.0.0.0/16"
}

# --- Banco de dados (RDS PostgreSQL) ---------------------------------------
variable "db_instance_class" {
  description = "Tamanho da máquina do banco."
  type        = string
  default     = "db.t4g.medium" # subir para db.r6g.* no GA sob carga real
}

variable "db_allocated_storage" {
  description = "Armazenamento inicial do banco em GB."
  type        = number
  default     = 50
}

variable "db_multi_az" {
  description = "Alta disponibilidade (2ª cópia em outra zona). true em produção."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Dias de retenção de backup automático (point-in-time restore)."
  type        = number
  default     = 14
}

# --- Redis (ElastiCache) ----------------------------------------------------
variable "redis_node_type" {
  description = "Tamanho do nó Redis."
  type        = string
  default     = "cache.t4g.small"
}

# --- Aplicação (ECS Fargate) ------------------------------------------------
variable "api_image" {
  description = "Imagem Docker da API (preenchida pelo pipeline de deploy)."
  type        = string
  default     = "" # ex.: <account>.dkr.ecr.eu-central-1.amazonaws.com/navix-api:sha
}

variable "web_image" {
  description = "Imagem Docker do web (Next.js)."
  type        = string
  default     = ""
}

variable "api_desired_count" {
  description = "Quantas cópias da API rodam em paralelo."
  type        = number
  default     = 2
}

variable "worker_desired_count" {
  description = "Quantas cópias do worker de otimização rodam em paralelo."
  type        = number
  default     = 1
}

variable "web_desired_count" {
  description = "Quantas cópias do web rodam em paralelo."
  type        = number
  default     = 2
}

variable "domain_name" {
  description = "Domínio base (ex.: navix.pt) para o certificado HTTPS e ALB."
  type        = string
  default     = ""
}
