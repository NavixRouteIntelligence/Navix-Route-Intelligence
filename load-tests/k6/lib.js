// Helpers compartilhados dos testes de carga (k6). Nada de dependência externa
// (k6 roda offline/CSP) — tudo aqui é self-contained.
import http from 'k6/http';
import { fail } from 'k6';

// Alvo configurável. Local por padrão; em staging/prod passe BASE_URL.
//   k6 run -e BASE_URL=https://navix-api.onrender.com/api/v1 load.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api/v1';

const EMAIL = __ENV.NAVIX_EMAIL || 'admin@navix.test';
const PASSWORD = __ENV.NAVIX_PASSWORD || 'ChangeMe123!';

/** Login mobile (bearer) → access token. Roda no setup() (uma vez, compartilhado). */
export function login() {
  const res = http.post(
    `${BASE_URL}/auth/mobile/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } },
  );
  if (res.status !== 200) fail(`login falhou (${res.status}): ${res.body}`);
  const token = res.json('tokens.accessToken');
  if (!token) fail('login sem accessToken no corpo');
  return token;
}

export function authHeaders(token, extra) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(extra || {}),
    },
  };
}

/** UUID v4 válido (o DTO valida @IsUUID nas paradas). Aleatório basta para carga. */
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Gera N paradas em torno de uma cidade europeia (Lisboa) — coordenadas plausíveis. */
export function makeStops(n) {
  const stops = [];
  for (let i = 0; i < n; i++) {
    stops.push({
      id: uuidv4(),
      latitude: 38.72 + (Math.random() - 0.5) * 0.12,
      longitude: -9.14 + (Math.random() - 0.5) * 0.12,
    });
  }
  return stops;
}
