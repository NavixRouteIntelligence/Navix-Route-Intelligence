import 'reflect-metadata';
// Instrumentação por efeito colateral: inicializa o OpenTelemetry ANTES de
// qualquer módulo instrumentado (AppModule, http, pg, ioredis) ser carregado.
// No-op quando OTEL_ENABLED != 'true'. Mantê-lo como PRIMEIRO import é essencial.
import './observability/instrument';

import { RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { shutdownTracing } from './observability/tracing';
import { AppConfigService } from './shared/config/app-config.service';
import { DomainExceptionFilter } from './shared/interface/domain-exception.filter';

async function bootstrap(): Promise<void> {
  // O parser padrão do Nest/Express limita JSON a 100 KB. Como o POD envia
  // foto e assinatura em base64, desativamo-lo para usar exclusivamente o
  // parser de 8 MB registrado logo abaixo.
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  // Logger estruturado (pino) como logger global.
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  const { port, globalPrefix, corsOrigins } = config.api;

  // Segurança de borda (ver docs/security.md §7). Em desenvolvimento o CSP é
  // desativado para permitir o Swagger UI (scripts inline); em produção o CSP
  // padrão do helmet fica ativo (o Swagger não é exposto lá).
  app.use(helmet({ contentSecurityPolicy: config.isProduction ? undefined : false }));
  // Corpo maior para comprovantes (foto/assinatura em base64 no Proof of Delivery).
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Api-Key', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86_400,
  });

  // Prefixo e versionamento de URL: /api/v1/... (ver docs/api.md §2).
  // `/metrics` fica FORA do prefixo (caminho de scrape padrão do Prometheus).
  app.setGlobalPrefix(globalPrefix, {
    exclude: [{ path: 'metrics', method: RequestMethod.GET }],
  });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Validação de entrada global (whitelist + rejeição de campos desconhecidos).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Tratamento de erros padronizado.
  app.useGlobalFilters(new DomainExceptionFilter());

  // OpenAPI/Swagger — exposto apenas fora de produção (ver docs/api.md §15).
  if (!config.isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Navix Route Intelligence API')
      .setDescription('API da plataforma de inteligência logística de última milha.')
      .setVersion('1.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', in: 'header', name: 'X-Api-Key' }, 'api-key')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  app.enableShutdownHooks();
  // Flush dos spans pendentes no encerramento (no-op se tracing desligado).
  process.on('beforeExit', () => {
    void shutdownTracing();
  });

  // Escuta também em IPv4: necessário para que o app Flutter em um dispositivo
  // físico na mesma rede local alcance a API de desenvolvimento pelo IP do Mac.
  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`Navix API em http://localhost:${port}/${globalPrefix}`);
  if (!config.isProduction) {
    logger.log(`Swagger em http://localhost:${port}/${globalPrefix}/docs`);
  }
}

void bootstrap();
