import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remover srcDir que no existe
  turbopack: {
    root: process.cwd(),
  },
  // Arreglar el warning de workspace
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
