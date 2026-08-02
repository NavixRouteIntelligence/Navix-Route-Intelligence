export interface GeofenceStatusAutomationInput {
  tenantId: string;
  /** ID da ficha da frota (ou do login para motorista autônomo). */
  driverId: string;
  recordedAt: Date;
}

/** Fronteira best-effort chamada depois que a posição já foi persistida. */
export interface GeofenceStatusAutomationPort {
  evaluate(input: GeofenceStatusAutomationInput): Promise<number>;
}

export const GEOFENCE_STATUS_AUTOMATION = Symbol('GEOFENCE_STATUS_AUTOMATION');
