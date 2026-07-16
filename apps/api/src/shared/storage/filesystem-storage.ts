import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import { MediaUrlSigner, resolveMediaSecret } from './media-url-signer';
import {
  storageKey,
  type StoragePort,
  type StorageSaveInput,
  type StoredMedia,
} from './storage.port';

/**
 * Driver **local** (dev/self-host): grava os objetos em disco e os serve pelo
 * `FilesController`. Guarda a **key** e gera a URL **assinada + expirável** no
 * *read* (ADR-0046) — mídia de PII não fica em URL pública permanente. Em
 * produção usa-se o driver S3 (ADR-0019).
 */
@Injectable()
export class FilesystemStorage implements StoragePort {
  private readonly dir: string;
  private readonly baseUrl: string;
  private readonly signer: MediaUrlSigner;

  constructor(config: AppConfigService) {
    this.dir = config.storage.localDir;
    this.baseUrl = config.storage.publicBaseUrl.replace(/\/+$/, '');
    this.signer = new MediaUrlSigner(
      resolveMediaSecret(config.storage.mediaUrlSecret),
      config.storage.mediaUrlTtlSeconds,
    );
  }

  async save(input: StorageSaveInput): Promise<StoredMedia> {
    const key = storageKey(input);
    const full = join(this.dir, key);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, input.buffer);
    return { ref: key };
  }

  readUrl(ref: string): Promise<string> {
    const { exp, sig } = this.signer.sign(ref);
    return Promise.resolve(`${this.baseUrl}/${ref}?exp=${exp}&sig=${sig}`);
  }

  async delete(ref: string): Promise<void> {
    try {
      await unlink(join(this.dir, ref));
    } catch {
      /* best-effort */
    }
  }
}
