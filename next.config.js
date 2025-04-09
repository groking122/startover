/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  // Ensure we handle the build of specific packages properly
  transpilePackages: ['@cardano-sdk/cip30', '@cardano-sdk/core', '@cardano-sdk/util', 'lucid-cardano'],
  // Configure webpack to handle topLevelAwait
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    }
    return config
  },
  // Skip specific routes during static building to avoid SSR issues
  skipMiddlewareUrlNormalize: true
};

export default nextConfig; 