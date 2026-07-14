import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import {
  storageKey,
  type StoragePort,
  type StorageSaveInput,
  type StoredMedia,
} from './storage.port';

/**
 * Driver **local** (dev): grava os objetos em disco e os serve pelo
 * `FilesController` (`GET /api/v1/files/...`). A URL retornada é estável e é o
 * que se persiste no banco. Em produção usa-se o driver S3 (ADR-0019).
 */
@Injectable()
export class FilesystemStorage implements StoragePort {
  private readonly dir: string;
  private readonly baseUrl: string;

  constructor(config: AppConfigService) {
    this.dir = config.storage.localDir;
    this.baseUrl = config.storage.publicBaseUrl.replace(/\/+$/, '');
  }

  async save(input: StorageSaveInput): Promise<StoredMedia> {
    const key = storageKey(input);
    const full = join(this.dir, key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, input.buffer);
    return { url: `${this.baseUrl}/${key}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(`${this.baseUrl}/`)) return;
    const key = url.slice(this.baseUrl.length + 1);
    try {
      await unlink(join(this.dir, key));
    } catch {
      /* best-effort */
    }
  }
}
