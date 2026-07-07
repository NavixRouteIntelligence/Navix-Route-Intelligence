import type { ImportBatchStatus, ImportFileType, ImportSummary } from '@navix/contracts';

import { newId } from '../../../shared/kernel/id';
import type { StoredImportRow } from './import-row';

export interface ImportBatchProps {
  id: string;
  tenantId: string;
  createdBy: string;
  filename: string;
  fileType: ImportFileType;
  status: ImportBatchStatus;
  summary: ImportSummary;
  rows: StoredImportRow[];
  createdDeliveries: number;
  routePlanId: string | null;
  createdAt: Date;
  importedAt: Date | null;
}

export type NewImportBatch = Pick<
  ImportBatchProps,
  'tenantId' | 'createdBy' | 'filename' | 'fileType' | 'summary' | 'rows'
>;

/** Lote de importação: rascunho (preview) até a confirmação. */
export class ImportBatch {
  private constructor(private props: ImportBatchProps) {}

  static create(data: NewImportBatch): ImportBatch {
    return new ImportBatch({
      ...data,
      id: newId(),
      status: 'preview',
      createdDeliveries: 0,
      routePlanId: null,
      createdAt: new Date(),
      importedAt: null,
    });
  }

  static restore(props: ImportBatchProps): ImportBatch {
    return new ImportBatch(props);
  }

  markImported(createdDeliveries: number, routePlanId: string | null): void {
    this.props.status = 'imported';
    this.props.createdDeliveries = createdDeliveries;
    this.props.routePlanId = routePlanId;
    this.props.importedAt = new Date();
  }

  snapshot(): Readonly<ImportBatchProps> {
    return this.props;
  }

  get id(): string {
    return this.props.id;
  }

  get status(): ImportBatchStatus {
    return this.props.status;
  }

  /** Linhas válidas e não-duplicadas (as que viram entregas). */
  get importableRows(): StoredImportRow[] {
    return this.props.rows.filter((r) => r.status === 'valid');
  }
}
