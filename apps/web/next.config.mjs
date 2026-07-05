/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compila o pacote de contratos compartilhado direto do TypeScript.
  transpilePackages: ['@navix/contracts'],
};

export default nextConfig;
