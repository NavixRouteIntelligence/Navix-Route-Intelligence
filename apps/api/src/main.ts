import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { AppConfigService } from './shared/config/app-config.service';
import { DomainExceptionFilter } from './shared/interface/domain-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger estruturado (pino) como logger global.
  app.useLogger(app.get(Logger));

  const config = app.get(AppConfigService);
  const { port, globalPrefix, corsOrigins } = config.api;

  // Segurança de borda (ver docs/security.md §7). Em desenvolvimento o CSP é
  // desativado para permitir o Swagger UI (scripts inline); em produção o CSP
  // padrão do helmet fica ativo (o Swagger não é exposto lá).
  app.use(helmet({ contentSecurityPolicy: config.isProduction ? undefined : false }));
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Api-Key', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    maxAge: 86_400,
  });

  // Prefixo e versionamento de URL: /api/v1/... (ver docs/api.md §2).
  app.setGlobalPrefix(globalPrefix);
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
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup(`${globalPrefix}/docs`, app, document);
  }

  app.enableShutdownHooks();

  await app.listen(port);
  const logger = app.get(Logger);
  logger.log(`Navix API em http://localhost:${port}/${globalPrefix}`);
  if (!config.isProduction) {
    logger.log(`Swagger em http://localhost:${port}/${globalPrefix}/docs`);
  }
}

void bootstrap();
