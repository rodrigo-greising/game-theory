/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Only warn for ESLint errors, don't fail the build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Also ignore TypeScript errors during builds
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 