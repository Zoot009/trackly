/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend is API-only; we serve no React pages beyond a health page.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
  eslint: { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
