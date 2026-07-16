import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';

import { Controller, Get, NotFoundException, Param, Query, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

import { AppConfigService } from '../config/app-config.service';
import { MediaUrlSigner, resolveMediaSecret } from './media-url-signer';

// Só imagens rasterizadas: SVG fica de fora (vetor de XSS quando servido inline).
const CONTENT_TYPE: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
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
  private readonly signer: MediaUrlSigner;

  constructor(config: AppConfigService) {
    this.dir = config.storage.localDir;
    this.enabled = config.storage.driver === 'local';
    this.signer = new MediaUrlSigner(
      resolveMediaSecret(config.storage.mediaUrlSecret),
      config.storage.mediaUrlTtlSeconds,
    );
  }

  @Get(':scope/:tenant/:name')
  serve(
    @Param('scope') scope: string,
    @Param('tenant') tenant: string,
    @Param('name') name: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Res() res: Response,
  ): void {
    if (!this.enabled) throw new NotFoundException();
    for (const part of [scope, tenant, name]) {
      if (!SAFE_SEGMENT.test(part) || part.includes('..')) throw new NotFoundException();
    }

    // Assinatura HMAC + expiração (ADR-0046): sem link válido, não serve a mídia.
    const key = `${scope}/${tenant}/${name}`;
    if (!this.signer.verify(key, Number(exp), sig ?? '')) throw new NotFoundException();

    const full = join(this.dir, scope, tenant, name);
    const ext = name.split('.').pop()?.toLowerCase() ?? '';

    const contentType = CONTENT_TYPE[ext];
    if (!contentType) throw new NotFoundException();

    void stat(full)
      .then(() => {
        res.setHeader('Content-Type', contentType);
        // Hardening anti-XSS (ADR-0039): impede sniffing e execução como HTML/SVG.
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `inline; filename="${name}"`);
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
        createReadStream(full).pipe(res);
      })
      .catch(() => {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Arquivo não encontrado.' } });
      });
  }
}
