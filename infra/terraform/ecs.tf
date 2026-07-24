# ---------------------------------------------------------------------------
# Computação: ECS Fargate. Três serviços que escalam de forma independente:
#   - api    (HTTP, atrás do ALB)
#   - worker (processa otimização de rotas via BullMQ — NÃO recebe HTTP)
#   - web    (Next.js, atrás do ALB)
# Separar api e worker é a correção do R3 (otimização não trava a API).
# ---------------------------------------------------------------------------

resource "aws_ecs_cluster" "this" {
  name = local.name
  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# --- Papéis IAM -------------------------------------------------------------
data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# Execução: puxar imagem do ECR, ler segredos, escrever logs.
resource "aws_iam_role" "task_execution" {
  name               = "${local.name}-task-exec"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "read_secrets" {
  name = "read-secrets"
  role = aws_iam_role.task_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = [aws_secretsmanager_secret.app.arn, aws_secretsmanager_secret.app_keys.arn]
    }]
  })
}

# Tarefa (runtime): a aplicação acessa S3 (mídia POD).
resource "aws_iam_role" "task" {
  name               = "${local.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy" "task_s3" {
  name = "pod-media-s3"
  role = aws_iam_role.task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
      Resource = ["${aws_s3_bucket.pod_media.arn}/*"]
    }]
  })
}

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name}"
  retention_in_days = 30
}

# --- Definição reutilizável de container -----------------------------------
locals {
  common_secrets = [
    { name = "DATABASE_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:DATABASE_URL::" },
    { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.app.arn}:REDIS_URL::" },
    { name = "JWT_PRIVATE_KEY", valueFrom = "${aws_secretsmanager_secret.app_keys.arn}:JWT_PRIVATE_KEY::" },
    { name = "JWT_PUBLIC_KEY", valueFrom = "${aws_secretsmanager_secret.app_keys.arn}:JWT_PUBLIC_KEY::" },
    { name = "ENCRYPTION_KEK", valueFrom = "${aws_secretsmanager_secret.app_keys.arn}:ENCRYPTION_KEK::" },
  ]
}

# ===== API =================================================================
resource "aws_ecs_task_definition" "api" {
  family                   = "${local.name}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name         = "api"
    image        = var.api_image
    essential    = true
    portMappings = [{ containerPort = 3000 }]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "OPTIMIZER_WORKER_ENABLED", value = "false" },
      { name = "STORAGE_DRIVER", value = "s3" },
      { name = "S3_BUCKET", value = aws_s3_bucket.pod_media.bucket },
    ]
    secrets = local.common_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "api"
      }
    }
    healthCheck = {
      command  = ["CMD-SHELL", "curl -f http://localhost:3000/api/v1/health || exit 1"]
      interval = 30
      timeout  = 5
      retries  = 3
    }
  }])
}

resource "aws_ecs_service" "api" {
  name            = "api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.app.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }
  lifecycle { ignore_changes = [task_definition, desired_count] } # deploy via pipeline
  depends_on = [aws_lb_listener.https]
}

# ===== WORKER (sem HTTP) ====================================================
resource "aws_ecs_task_definition" "worker" {
  family                   = "${local.name}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 1024
  memory                   = 2048
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name      = "worker"
    image     = var.api_image # mesma imagem da API, comando diferente
    essential = true
    command   = ["node", "dist/main-worker.js"]
    environment = [
      { name = "NODE_ENV", value = "production" },
      { name = "OPTIMIZER_WORKER_ENABLED", value = "true" },
    ]
    secrets = local.common_secrets
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

resource "aws_ecs_service" "worker" {
  name            = "worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.app.id]
  }
  lifecycle { ignore_changes = [task_definition, desired_count] }
}

# ===== WEB (Next.js) ========================================================
resource "aws_ecs_task_definition" "web" {
  family                   = "${local.name}-web"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.task_execution.arn
  task_role_arn            = aws_iam_role.task.arn

  container_definitions = jsonencode([{
    name         = "web"
    image        = var.web_image
    essential    = true
    portMappings = [{ containerPort = 3000 }]
    environment  = [{ name = "NODE_ENV", value = "production" }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.app.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "web"
      }
    }
  }])
}

resource "aws_ecs_service" "web" {
  name            = "web"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.web_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = module.vpc.private_subnets
    security_groups = [aws_security_group.app.id]
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 3000
  }
  lifecycle { ignore_changes = [task_definition, desired_count] }
  depends_on = [aws_lb_listener.https]
}
