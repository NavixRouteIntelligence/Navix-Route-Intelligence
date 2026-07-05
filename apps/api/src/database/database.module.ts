import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppConfigService } from '../shared/config/app-config.service';

/**
 * Conexão com o PostgreSQL via TypeORM. A aplicação conecta através do
 * PgBouncer (pooling em modo transaction — ver docs/database.md §5).
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const db = config.database;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.user,
          password: db.password,
          database: db.name,
          ssl: db.ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: false, // Nunca em produção: schema evolui só por migrações.
          migrationsRun: false,
          logging: !config.isProduction,
          // PgBouncer em modo transaction não suporta prepared statements nomeados.
          extra: { max: 20 },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
