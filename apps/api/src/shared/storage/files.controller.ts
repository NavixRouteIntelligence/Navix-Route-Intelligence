import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { AppConfigService } from '../config/app-config.service';

const CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
};

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Serve os objetos do driver **local** (`GET /api/v1/files/:scope/:tenant/:name`).
 * Público por design (URL de capacidade — a chave contém UUIDs não-adivinháveis),
 * como é comum para mídia consumida por `<img src>`. **Em produção** usa-se o
 * driver S3 com URL de bucket/CDN (e, se necessário, URLs assinadas). Ver ADR-0019.
 */
@ApiExcludeController()
@Controller({ path: 'files', version: '1' })
export class FilesController {
  private readonly dir: string;
  private readonly enabled: boolean;

  constructor(config: AppConfigService) {
    this.dir = config.storage.localDir;
    this.enabled = config.storage.driver === 'local';
  }

  @Get(':scope/:tenant/:name')
  serve(
    @Param('scope') scope: string,
    @Param('tenant') tenant: string,
    @Param('name') name: string,
    @Res() res: Response,
  ): void {
    if (!this.enabled) throw new NotFoundException();
    for (const part of [scope, tenant, name]) {
      if (!SAFE_SEGMENT.test(part) || part.includes('..')) throw new NotFoundException();
    }

    const full = join(this.dir, scope, tenant, name);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    void stat(full)
      .then(() => {
        res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        createReadStream(full).pipe(res);
      })
      .catch(() => {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Arquivo não encontrado.' } });
      });
  }
}
