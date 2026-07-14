import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';
import {
  storageKey,
  type StoragePort,
  type StorageSaveInput,
  type StoredMedia,
} from './storage.port';

/**
 * Driver **S3-compatível** (produção): AWS S3, Cloudflare R2 e Google GCS — os
 * três expõem a API S3, bastando configurar `S3_ENDPOINT`/`S3_FORCE_PATH_STYLE`
 * (ADR-0019). O objeto é enviado ao bucket e a URL pública (bucket/CDN) é o que
 * fica salvo no banco.
 */
@Injectable()
export class S3CompatibleStorage implements StoragePort {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(config: AppConfigService) {
    const s3 = config.storage.s3;
    if (!s3.bucket || !s3.publicBaseUrl) {
      throw new Error('STORAGE_DRIVER=s3 exige S3_BUCKET e S3_PUBLIC_BASE_URL.');
    }
    this.client = new S3Client({
      region: s3.region,
      endpoint: s3.endpoint,
      forcePathStyle: s3.forcePathStyle,
      credentials:
        s3.accessKeyId && s3.secretAccessKey
          ? { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey }
          : undefined,
    });
    this.bucket = s3.bucket;
    this.baseUrl = s3.publicBaseUrl.replace(/\/+$/, '');
  }

  async save(input: StorageSaveInput): Promise<StoredMedia> {
    const key = storageKey(input);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.contentType,
      }),
    );
    return { url: `${this.baseUrl}/${key}` };
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(`${this.baseUrl}/`)) return;
    const key = url.slice(this.baseUrl.length + 1);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
