import type { UpdateProfileRequest, UserProfile } from '@navix/contracts';

import { ValidationError } from '../../../shared/kernel/domain-error';

/**
 * Perfil de um usuário (1:1 com `users`). Sem dependências de framework/ORM
 * (ver docs/architecture.md §3). O avatar trafega como data URL, coerente com
 * o padrão de mídia do projeto (ver POD).
 */
export interface UserProfileRecord {
  tenantId: string;
  userId: string;
  profile: UserProfile;
  updatedAt: Date;
}

/** Limite do data URL do avatar (~2 MB) — guarda contra payloads abusivos. */
export const MAX_AVATAR_DATA_URL = 2_000_000;

const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
const PHONE_E164 = /^\+?[1-9]\d{6,14}$/;

/** Perfil default derivado do e-mail (quando o usuário nunca configurou). */
export function defaultProfile(email: string): UserProfile {
  const localPart = email.split('@')[0] ?? 'usuário';
  return {
    displayName: localPart,
    phone: null,
    jobTitle: null,
    timeZone: DEFAULT_TIME_ZONE,
    avatarUrl: null,
  };
}

function normalizeText(value: string, field: string, min: number, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    throw new ValidationError(`${field} deve ter entre ${min} e ${max} caracteres.`);
  }
  return trimmed;
}

function normalizeOptional(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > max) {
    throw new ValidationError(`${field} deve ter no máximo ${max} caracteres.`);
  }
  return trimmed;
}

/**
 * Aplica um patch validado sobre o perfil atual. Campos ausentes preservam o
 * valor; `null`/vazio limpam os opcionais. Lança `ValidationError` em entradas
 * inválidas (nome, telefone, fuso).
 */
export function applyProfilePatch(current: UserProfile, patch: UpdateProfileRequest): UserProfile {
  const next: UserProfile = { ...current };

  if (patch.displayName !== undefined) {
    next.displayName = normalizeText(patch.displayName, 'Nome de exibição', 2, 80);
  }
  if (patch.jobTitle !== undefined) {
    next.jobTitle = normalizeOptional(patch.jobTitle, 'Cargo', 80);
  }
  if (patch.phone !== undefined) {
    const phone = normalizeOptional(patch.phone, 'Telefone', 20);
    if (phone !== null && !PHONE_E164.test(phone.replace(/[\s()-]/g, ''))) {
      throw new ValidationError('Telefone inválido. Use o formato internacional (E.164).');
    }
    next.phone = phone ? phone.replace(/[\s()-]/g, '') : null;
  }
  if (patch.timeZone !== undefined) {
    next.timeZone = normalizeText(patch.timeZone, 'Fuso horário', 1, 64);
  }

  return next;
}

/** Valida o data URL do avatar (tipo de imagem + tamanho). */
export function assertValidAvatar(dataUrl: string): void {
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl)) {
    throw new ValidationError('Avatar deve ser uma imagem PNG, JPEG ou WebP.');
  }
  if (dataUrl.length > MAX_AVATAR_DATA_URL) {
    throw new ValidationError('Avatar excede o tamanho máximo (2 MB).');
  }
}
