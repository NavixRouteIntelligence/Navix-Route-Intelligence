/** @type {import('next').NextConfig} */

// Normaliza o destino do proxy: aceita com ou sem esquema (prefixa https://) e
// remove a barra final. Assim `API_PROXY_ORIGIN=navix-api.onrender.com`,
// `https://navix-api.onrender.com` e `.../` produzem o mesmo destino válido.
function normalizeProxyTarget(raw) {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, '');
}

const proxyTarget = normalizeProxyTarget(process.env.API_PROXY_ORIGIN);
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api';

// Diagnóstico no boot: se o navegador chama a API same-origin (/api) mas o proxy
// não tem destino, TODA chamada /api/* cai no 404 do próprio Next (HTML) e o
// front mostra "Erro inesperado". Avisa alto para não perder horas depois.
if (apiBaseUrl.startsWith('/') && !proxyTarget) {
  // eslint-disable-next-line no-console
  console.warn(
    '[navix] NEXT_PUBLIC_API_BASE_URL é same-origin (%s) mas API_PROXY_ORIGIN não está definido: ' +
      'as chamadas /api/* NÃO serão encaminhadas à API (cairão no 404 do Next). ' +
      'Defina API_PROXY_ORIGIN com a URL da API.',
    apiBaseUrl,
  );
}

const nextConfig = {
  reactStrictMode: true,
  // Compila o pacote de contratos compartilhado direto do TypeScript.
  transpilePackages: ['@navix/contracts'],

  // Proxy same-origin para a API. O navegador chama o próprio host do painel
  // (ex.: /api/v1/...) e o Next encaminha para a API por trás. Isso mantém o
  // cookie HttpOnly de sessão como first-party — essencial quando painel e API
  // ficam em hosts distintos (ex.: *.onrender.com, que o browser trata como
  // sites separados). Destino configurável por API_PROXY_ORIGIN (runtime).
  async rewrites() {
    if (!proxyTarget) return [];
    return [{ source: '/api/:path*', destination: `${proxyTarget}/api/:path*` }];
  },
};

export default nextConfig;
