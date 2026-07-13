'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword({ email });
      setMessage(res.message);
      // Em dev, o backend retorna o token para concluir o fluxo sem e-mail.
      if (res.resetToken) setResetToken(res.resetToken);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao solicitar recuperação.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword({ token: resetToken, newPassword });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao redefinir a senha.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Senha redefinida</CardTitle>
          <CardDescription>Você já pode entrar com a nova senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href="/login">Voltar ao login</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperar senha</CardTitle>
        <CardDescription>Informe seu e-mail para receber instruções.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={requestReset} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" loading={loading} className="w-full">
            Enviar instruções
          </Button>
        </form>

        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {resetToken && (
          <form onSubmit={confirmReset} className="grid gap-4 border-t border-border pt-5">
            <p className="text-xs text-muted-foreground">
              Modo demo: use o token gerado abaixo para definir uma nova senha.
            </p>
            <div className="grid gap-1.5">
              <Label>Token de recuperação</Label>
              <Input value={resetToken} onChange={(e) => setResetToken(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="mínimo 8 caracteres"
                required
              />
            </div>
            <Button type="submit" loading={loading} className="w-full">
              Redefinir senha
            </Button>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="text-center text-sm">
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            Voltar ao login
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
