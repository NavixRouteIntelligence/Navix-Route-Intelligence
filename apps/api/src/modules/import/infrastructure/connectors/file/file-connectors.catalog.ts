import type { ImportConnectorDescriptor } from '@navix/contracts';

/** Descritores dos conectores de arquivo disponíveis hoje. */
export const CSV_DESCRIPTOR: ImportConnectorDescriptor = {
  id: 'csv',
  kind: 'file',
  status: 'available',
  label: 'CSV',
  description: 'Arquivos separados por vírgula, com detecção automática de colunas.',
  accepts: ['.csv'],
  capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
};

export const XLSX_DESCRIPTOR: ImportConnectorDescriptor = {
  id: 'xlsx',
  kind: 'file',
  status: 'available',
  label: 'Excel',
  description: 'Planilhas Excel (XLS/XLSX); a primeira aba é usada como origem.',
  accepts: ['.xls', '.xlsx'],
  capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
};

export const PDF_DESCRIPTOR: ImportConnectorDescriptor = {
  id: 'pdf',
  kind: 'file',
  status: 'available',
  label: 'PDF',
  description: 'Extração best-effort de texto; linhas marcadas com baixa confiança.',
  accepts: ['.pdf'],
  capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
};
