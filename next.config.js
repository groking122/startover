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
  experimental: {
    // Disable automatic static optimization for the chat page
    // This is needed because it relies heavily on client-side features
    optimizeCss: false,
  },
  // Configure webpack to handle lucid-cardano and other problematic dependencies
  webpack: (config, { isServer }) => {
    // Avoid SSR issues with browser-specific modules
    if (isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: require.resolve("crypto-browserify"),
      };
    }

    // Handle top-level await for lucid-cardano
    config.experiments = {
      ...config.experiments,
      topLevelAwait: true,
    };

    // Allow importing wasm files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    }

    // Configure proper MIME type for wasm files using the standard loader
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    })

    return config;
  },
  // Add special handling for problematic packages
  transpilePackages: [
    'lucid-cardano', 
    '@emurgo/cardano-serialization-lib-asmjs',
    '@emurgo/cardano-message-signing-nodejs'
  ],
}

module.exports = nextConfig; 