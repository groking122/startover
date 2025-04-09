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
  transpilePackages: ['@cardano-sdk/cip30', '@cardano-sdk/core', '@cardano-sdk/util'],
  // Configure external packages that shouldn't be bundled
  experimental: {
    // This is necessary to handle cardano libraries that access window
    serverExternalPackages: ['lucid-cardano']
  },
  // Ensure we do proper handling of lucid-cardano's usage of topLevelAwait
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    }
    return config
  }
};

export default nextConfig; 