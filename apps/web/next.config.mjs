/** @type {import('next').NextConfig} */
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
    const target = process.env.API_PROXY_ORIGIN;
    if (!target) return [];
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
