import type { ImportConnectorDescriptor } from '@navix/contracts';

/**
 * Catálogo de conectores planejados. Cada entrada declara a família e as
 * capacidades esperadas — a arquitetura fica pronta; a implementação entra depois.
 *
 * Captura (scan/imagem): Barcode, QR Code, OCR.
 * Integração (externa):   E-mail, API, Webhooks, ERP.
 */
export const PLANNED_CONNECTOR_DESCRIPTORS: readonly ImportConnectorDescriptor[] = [
  {
    id: 'barcode',
    kind: 'capture',
    status: 'planned',
    label: 'Código de barras',
    description: 'Leitura de códigos de barras (ex.: etiquetas de encomenda) para gerar entregas.',
    accepts: ['.png', '.jpg', '.jpeg'],
    capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
  },
  {
    id: 'qrcode',
    kind: 'capture',
    status: 'planned',
    label: 'QR Code',
    description: 'Leitura de QR Codes com dados estruturados da entrega.',
    accepts: ['.png', '.jpg', '.jpeg'],
    capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
  },
  {
    id: 'ocr',
    kind: 'capture',
    status: 'planned',
    label: 'OCR',
    description: 'Reconhecimento óptico de PDFs escaneados e imagens de romaneios.',
    accepts: ['.pdf', '.png', '.jpg', '.jpeg'],
    capabilities: { fileUpload: true, pull: false, push: false, requiresConfig: false },
  },
  {
    id: 'email',
    kind: 'integration',
    status: 'planned',
    label: 'E-mail',
    description: 'Ingestão a partir de e-mails recebidos (inbound) com pedidos/anexos.',
    capabilities: { fileUpload: false, pull: true, push: true, requiresConfig: true },
  },
  {
    id: 'api',
    kind: 'integration',
    status: 'planned',
    label: 'API externa',
    description: 'Puxa pedidos de APIs de terceiros (marketplaces, e-commerce).',
    capabilities: { fileUpload: false, pull: true, push: false, requiresConfig: true },
  },
  {
    id: 'webhook',
    kind: 'integration',
    status: 'planned',
    label: 'Webhooks',
    description: 'Recebe eventos de pedidos em tempo real via webhook.',
    capabilities: { fileUpload: false, pull: false, push: true, requiresConfig: true },
  },
  {
    id: 'erp',
    kind: 'integration',
    status: 'planned',
    label: 'ERP',
    description: 'Integração com ERPs (ex.: SAP, TOTVS) para importar ordens de entrega.',
    capabilities: { fileUpload: false, pull: true, push: false, requiresConfig: true },
  },
];
