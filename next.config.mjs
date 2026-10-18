/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.DIST_DIR ?? ".next", // lets `next dev` use its own folder so it never overwrites a running production build
  serverExternalPackages: ["@prisma/client", "msedge-tts", "unpdf", "mammoth", "bcryptjs"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};
export default nextConfig;
