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
  # As chaves abaixo são exatamente as que o envSchema exige (ver secrets.tf e
  # apps/api/src/shared/config/env.schema.ts). Derivadas das MESMAS estruturas
  # que montam o segredo, para que um não saia do outro sem quebrar o plan.
  app_secret_keys  = keys(local.app_env_secrets)
  app_key_material = ["JWT_PRIVATE_KEY", "JWT_PUBLIC_KEY", "JWT_KEY_ID", "MEDIA_URL_SECRET", "ENCRYPTION_KEK"]

  common_secrets = concat(
    [for k in local.app_secret_keys : {
      name = k, valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::"
    }],
    [for k in local.app_key_material : {
      name = k, valueFrom = "${aws_secretsmanager_secret.app_keys.arn}:${k}::"
    }],
  )

  # Ambiente comum a API e worker: mesma imagem, mesma topologia de fila.
  common_environment = [
    { name = "NODE_ENV", value = "production" },
    # Fila durável no Redis com worker dedicado (ADR-0055). Sem isto o driver
    # cai no default `inprocess`: a API processaria a otimização no próprio
    # event loop e o serviço `worker` ficaria ocioso — a separação api/worker
    # (correção do R3) existiria só no papel.
    { name = "OPTIMIZER_QUEUE_DRIVER", value = "bullmq" },
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
    environment = concat(local.common_environment, [
      # A app escuta em API_PORT (default 3001). O portMapping, o target group e
      # o healthcheck usam 3000 — sem fixar aqui, o ALB nunca acharia a porta e
      # o circuit breaker reverteria todo deploy.
      { name = "API_PORT", value = "3000" },
      # Só enfileira; quem processa é o serviço `worker`.
      { name = "OPTIMIZER_WORKER_ENABLED", value = "false" },
      { name = "STORAGE_DRIVER", value = "s3" },
      { name = "S3_BUCKET", value = aws_s3_bucket.pod_media.bucket },
      # Região real do bucket: o default do schema é "auto" (convenção de
      # Cloudflare R2), que o SDK da AWS não resolve.
      { name = "S3_REGION", value = var.aws_region },
      # Path-style é coisa de S3 compatível; no S3 da AWS o certo é virtual-host.
      { name = "S3_FORCE_PATH_STYLE", value = "false" },
      # Sem credenciais explícitas de S3: o SDK cai na IAM task role (task_s3).
    ])
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

  # Rollback automático: se as tarefas novas não passarem no healthcheck, o ECS
  # reverte sozinho para a última revisão saudável. É o que sustenta a promessa
  # de rollback do runbook de DR (§3.1) e do pipeline de CD.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
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
    # Caminho relativo ao WORKDIR /repo da imagem (docker/api.Dockerfile), que
    # copia o build para apps/api/dist. "dist/main-worker.js" não existe lá.
    command = ["node", "apps/api/dist/main-worker.js"]
    environment = concat(local.common_environment, [
      # Este é o processo que consome a fila.
      { name = "OPTIMIZER_WORKER_ENABLED", value = "true" },
      # O worker também grava mídia de POD (mesma task role da API).
      { name = "STORAGE_DRIVER", value = "s3" },
      { name = "S3_BUCKET", value = aws_s3_bucket.pod_media.bucket },
      { name = "S3_REGION", value = var.aws_region },
      { name = "S3_FORCE_PATH_STYLE", value = "false" },
    ])
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

  # O worker não fica atrás do ALB: aqui o circuit breaker protege contra uma
  # revisão que sobe e morre em loop (crash na inicialização).
  deployment_circuit_breaker {
    enable   = true
    rollback = true
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
    portMappings = [{ containerPort = 3000 }] # Next.js `npm run start` usa 3000
    # O web é um front-end Next.js: NÃO recebe `local.common_secrets`. Ele não
    # fala com o Postgres nem com o Redis, então injetar as credenciais aqui
    # ampliaria o raio de exposição sem nenhum ganho (menor privilégio).
    # As NEXT_PUBLIC_* são assadas no build (docker/web.Dockerfile, build-args);
    # só o proxy server-side precisa de valor em runtime.
    environment = [
      { name = "NODE_ENV", value = "production" },
      {
        name  = "API_PROXY_ORIGIN"
        value = var.domain_name == "" ? "http://${aws_lb.this.dns_name}" : "https://api.${var.domain_name}"
      },
    ]
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

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle { ignore_changes = [task_definition, desired_count] }
  depends_on = [aws_lb_listener.https]
}
