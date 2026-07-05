'use client';

import { useState, type FormEvent } from 'react';

import { authApi, ApiError } from '@/lib/api-client';

/**
 * Tela de login inicial (Fase 0). Consome POST /api/v1/auth/login via o
 * cliente de API tipado. Persistência de sessão/token será tratada em fase
 * posterior (cookies httpOnly).
 */
export default function LoginPage() {
  const [tenantId, setTenantId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<{ kind: 'idle' | 'loading' | 'error' | 'ok'; message?: string }>({
    kind: 'idle',
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus({ kind: 'loading' });
    try {
      const result = await authApi.login({ tenantId, email, password });
      setStatus({ kind: 'ok', message: `Autenticado como ${result.user.email}` });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Falha ao entrar.';
      setStatus({ kind: 'error', message });
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Entrar</h1>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: '1rem', marginTop: '1.5rem' }}>
        <Field label="Tenant ID" value={tenantId} onChange={setTenantId} placeholder="uuid do tenant" />
        <Field label="E-mail" type="email" value={email} onChange={setEmail} placeholder="voce@empresa.com" />
        <Field label="Senha" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
        <button
          type="submit"
          disabled={status.kind === 'loading'}
          style={{
            padding: '0.75rem',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent)',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {status.kind === 'loading' ? 'Entrando…' : 'Entrar'}
        </button>
      </form>

      {status.message && (
        <p style={{ marginTop: '1rem', color: status.kind === 'error' ? 'var(--error)' : 'var(--muted)' }}>
          {status.message}
        </p>
      )}
    </main>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'grid', gap: '0.35rem', fontSize: '0.9rem', color: 'var(--muted)' }}>
      {props.label}
      <input
        type={props.type ?? 'text'}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        required
        style={{
          padding: '0.65rem',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          color: 'var(--text)',
        }}
      />
    </label>
  );
}
