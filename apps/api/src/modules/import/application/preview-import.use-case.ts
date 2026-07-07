import { Inject, Injectable } from '@nestjs/common';
import type {
  ImportFileType,
  ImportPreviewResponse,
  ImportRowStatus,
  ImportSummary,
} from '@navix/contracts';

import { AUDIT_LOG, type AuditLogPort } from '../../../shared/audit/audit-log.port';
import { ImportBatch } from '../domain/import-batch';
import type { StoredImportRow } from '../domain/import-row';
import {
  ADDRESS_CLASSIFIER,
  type AddressClassifierPort,
} from '../domain/ports/address-classifier.port';
import { GEOCODER, type GeocoderPort, type GeocodeResult } from '../domain/ports/geocoder.port';
import {
  IMPORT_BATCH_REPOSITORY,
  type ImportBatchRepositoryPort,
} from '../domain/ports/import-batch-repository.port';
import { ROUTE_ESTIMATOR, type RouteEstimatorPort } from '../domain/ports/route-estimator.port';
import { toPreviewResponse } from './mappers/import.mapper';
import { normalizePriority, resolveAddress } from './normalize';
import { ParserRegistry } from './parser-registry';

const MAX_ROWS = 1000;

export interface PreviewImportCommand {
  tenantId: string;
  actorId: string;
  filename: string;
  fileType: ImportFileType;
  buffer: Buffer;
}

@Injectable()
export class PreviewImportUseCase {
  constructor(
    private readonly registry: ParserRegistry,
    @Inject(GEOCODER) private readonly geocoder: GeocoderPort,
    @Inject(ADDRESS_CLASSIFIER) private readonly classifier: AddressClassifierPort,
    @Inject(ROUTE_ESTIMATOR) private readonly estimator: RouteEstimatorPort,
    @Inject(IMPORT_BATCH_REPOSITORY) private readonly repo: ImportBatchRepositoryPort,
    @Inject(AUDIT_LOG) private readonly audit: AuditLogPort,
  ) {}

  async execute(command: PreviewImportCommand): Promise<ImportPreviewResponse> {
    const parser = this.registry.get(command.fileType);
    const parsed = (await parser.parse(command.buffer)).slice(0, MAX_ROWS);

    const rows: StoredImportRow[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const recipient = p.recipient ?? null;
      const addressText = p.addressText ?? '';
      const errors: string[] = [];
      let latitude = p.latitude ?? null;
      let longitude = p.longitude ?? null;
      let geocoded = false;
      let geo: GeocodeResult | null = null;

      if ((latitude === null || longitude === null) && addressText) {
        geo = await this.geocoder.geocode(addressText);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
          geocoded = true;
        }
      }

      if (!addressText) errors.push('Endereço ausente.');
      if (latitude === null || longitude === null) errors.push('Não foi possível obter coordenadas.');

      const resolved = errors.length === 0 ? resolveAddress(addressText, geo) : null;
      const dedupKey = (p.orderNumber ?? `${addressText}|${latitude},${longitude}`).toLowerCase();

      let status: ImportRowStatus = errors.length > 0 ? 'invalid' : 'valid';
      if (status === 'valid') {
        if (seen.has(dedupKey)) status = 'duplicate';
        else seen.add(dedupKey);
      }

      rows.push({
        index: i + 1,
        status,
        recipient,
        phone: p.phone ?? null,
        orderNumber: p.orderNumber ?? null,
        notes: p.notes ?? null,
        priority: normalizePriority(p.priority),
        addressText,
        latitude,
        longitude,
        addressCategory: this.classifier.classify(addressText, recipient),
        geocoded,
        lowConfidence: p.lowConfidence ?? false,
        errors,
        resolved,
        dedupKey,
      });
    }

    const valid = rows.filter((r) => r.status === 'valid');
    let estimatedSavingsKm = 0;
    let estimatedSavingsPct = 0;
    if (valid.length >= 2) {
      const est = await this.estimator.estimate(
        valid.map((r) => ({ latitude: r.latitude as number, longitude: r.longitude as number, priority: r.priority })),
      );
      estimatedSavingsKm = est.savingsKm;
      estimatedSavingsPct = est.savingsPct;
    }

    const summary: ImportSummary = {
      total: rows.length,
      valid: valid.length,
      invalid: rows.filter((r) => r.status === 'invalid').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      estimatedSavingsKm,
      estimatedSavingsPct,
    };

    const batch = ImportBatch.create({
      tenantId: command.tenantId,
      createdBy: command.actorId,
      filename: command.filename,
      fileType: command.fileType,
      summary,
      rows,
    });
    await this.repo.save(batch);
    await this.audit.record({
      tenantId: command.tenantId,
      actorId: command.actorId,
      action: 'import.previewed',
      resource: `import:${batch.id}`,
      metadata: { total: rows.length, valid: valid.length, file: command.fileType },
    });

    return toPreviewResponse(batch);
  }
}
