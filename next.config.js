/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
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
  transpilePackages: ['lucid-cardano', '@cardano-sdk/cip30', '@cardano-sdk/core', '@cardano-sdk/util'],
  // Configure external packages that shouldn't be bundled
  experimental: {
    // This is necessary to handle cardano libraries that access window
    serverComponentsExternalPackages: ['lucid-cardano']
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

module.exports = nextConfig; 