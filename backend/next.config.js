/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The backend is API-only; we serve no React pages beyond a health page.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
  eslint: { ignoreDuringBuilds: true },
  // Screenshot uploads (WebP) can exceed Next's default 1 MB request-body cap.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
};

module.exports = nextConfig;
