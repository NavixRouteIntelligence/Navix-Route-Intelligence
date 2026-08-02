export const EXTERNAL_EVENT_TYPES = [
  'delivery.created',
  'delivery.updated',
  'pod.submitted',
  'eta.updated',
] as const;

export type ExternalEventType = (typeof EXTERNAL_EVENT_TYPES)[number];

export interface ExternalEventInput {
  tenantId: string;
  type: ExternalEventType;
  aggregateId: string;
  payload: Record<string, unknown>;
}

export interface ExternalEventOutboxPort {
  record(input: ExternalEventInput): Promise<void>;
}

export const EXTERNAL_EVENT_OUTBOX = Symbol('EXTERNAL_EVENT_OUTBOX');
