import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@electric-sql/pglite', 'pg'],
  outputFileTracingIncludes: {
    '/**': ['./supabase/migrations/**/*'],
  },
};

export default nextConfig;
