import { Global, Module } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { FilesController } from './files.controller';
import { FilesystemStorage } from './filesystem-storage';
import { S3CompatibleStorage } from './s3-storage';
import { STORAGE } from './storage.port';

/**
 * `StorageService` global (ADR-0019). Seleciona o driver por `STORAGE_DRIVER`:
 * `local` (disco + `/files`) em dev, `s3` (S3/R2/GCS) em produção. O cliente S3
 * só é instanciado quando o driver é `s3`.
 */
@Global()
@Module({
  controllers: [FilesController],
  providers: [
    FilesystemStorage,
    {
      provide: STORAGE,
      inject: [AppConfigService, FilesystemStorage],
      useFactory: (config: AppConfigService, local: FilesystemStorage) =>
        config.storage.driver === 's3' ? new S3CompatibleStorage(config) : local,
    },
  ],
  exports: [STORAGE],
})
export class StorageModule {}
