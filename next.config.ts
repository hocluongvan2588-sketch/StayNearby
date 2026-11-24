import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['*.e2b.app', 'localhost', '127.0.0.1'],
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'geoip-country'],
  outputFileTracingIncludes: {
    '/**': ['./supabase/migrations/**/*'],
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
