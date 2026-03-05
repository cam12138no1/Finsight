const createNextIntlPlugin = require('next-intl/plugin')

const withNextIntl = createNextIntlPlugin()

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
  images: {
    domains: ['blob.vercel-storage.com'],
  },
  env: {
    // Expose Vercel's deployment environment to client components.
    // Values: 'production' | 'preview' | 'development' (local)
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? 'development',
  },
}

module.exports = withNextIntl(nextConfig)
