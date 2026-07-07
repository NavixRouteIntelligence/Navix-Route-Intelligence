import type { ImportBatchView, ImportPreviewResponse, ImportRowView } from '@navix/contracts';

import type { ImportBatch } from '../../domain/import-batch';
import type { StoredImportRow } from '../../domain/import-row';

export function toRowView(row: StoredImportRow): ImportRowView {
  const { resolved: _resolved, dedupKey: _dedupKey, ...view } = row;
  void _resolved;
  void _dedupKey;
  return view;
}

export function toBatchView(batch: ImportBatch): ImportBatchView {
  const s = batch.snapshot();
  return {
    id: s.id,
    tenantId: s.tenantId,
    filename: s.filename,
    fileType: s.fileType,
    status: s.status,
    summary: s.summary,
    createdDeliveries: s.createdDeliveries,
    routePlanId: s.routePlanId,
    createdAt: s.createdAt.toISOString(),
    importedAt: s.importedAt ? s.importedAt.toISOString() : null,
  };
}

export function toPreviewResponse(batch: ImportBatch): ImportPreviewResponse {
  return {
    batch: toBatchView(batch),
    rows: batch.snapshot().rows.map(toRowView),
  };
}
