import {
  EXTERNAL_EVENT_TYPES,
  type ExternalEventType,
} from '../../../shared/events/external-event-outbox.port';

export const PUBLIC_API_SCOPES = [
  'deliveries:read',
  'deliveries:write',
  'pod:read',
  'eta:read',
] as const;

export type PublicApiScope = (typeof PUBLIC_API_SCOPES)[number];

export const PUBLIC_WEBHOOK_EVENTS = EXTERNAL_EVENT_TYPES;
export type PublicWebhookEvent = ExternalEventType;

export interface ApiKeyPrincipal {
  keyId: string;
  tenantId: string;
  scopes: PublicApiScope[];
  quotaPerMinute: number;
}
