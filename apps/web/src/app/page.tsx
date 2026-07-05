import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Navix Route Intelligence</h1>
      <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
        Estrutura base (Fase 0). Backend NestJS + PostgreSQL/PostGIS + Redis e frontend
        Next.js. Funcionalidades de negócio ainda não implementadas.
      </p>
      <p style={{ marginTop: '2rem' }}>
        <Link href="/login">Ir para o login →</Link>
      </p>
    </main>
  );
}
