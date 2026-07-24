# ---------------------------------------------------------------------------
# Load balancer (porta de entrada HTTPS) + certificado + roteamento:
#   api.<dominio>  -> serviço API
#   demais hosts   -> serviço Web (app, track, *.dominio)
# ---------------------------------------------------------------------------

resource "aws_lb" "this" {
  name               = "${local.name}-alb"
  load_balancer_type = "application"
  subnets            = module.vpc.public_subnets
  security_groups    = [aws_security_group.alb.id]
}

resource "aws_lb_target_group" "api" {
  name        = "${local.name}-api"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  health_check {
    path                = "/api/v1/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

resource "aws_lb_target_group" "web" {
  name        = "${local.name}-web"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"
  health_check {
    path                = "/"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

# Certificado HTTPS (DNS validation feita no Cloudflare — ver 02-dominios.md).
resource "aws_acm_certificate" "this" {
  count                     = var.domain_name == "" ? 0 : 1
  domain_name               = var.domain_name
  subject_alternative_names = ["*.${var.domain_name}"]
  validation_method         = "DNS"
  lifecycle { create_before_destroy = true }
}

# Redireciona HTTP -> HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.domain_name == "" ? null : aws_acm_certificate.this[0].arn

  # Padrão: web.
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

# api.<dominio> vai para o serviço API.
resource "aws_lb_listener_rule" "api" {
  count        = var.domain_name == "" ? 0 : 1
  listener_arn = aws_lb_listener.https.arn
  priority     = 10
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
  condition {
    host_header { values = ["api.${var.domain_name}"] }
  }
}
