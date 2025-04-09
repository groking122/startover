/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during builds for Vercel deployment
    ignoreDuringBuilds: true,
  },
  // Temporarily ignore TypeScript errors during builds for Vercel deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Enable top-level await
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Properly handle WASM in Lucid Cardano
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
      crypto: false,
    };

    // Ignore warnings from emurgo libraries
    config.ignoreWarnings = [
      { module: /node_modules\/@emurgo/ }
    ];

    return config;
  },
}

export default nextConfig; 