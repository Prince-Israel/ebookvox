/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs", "sharp"],
  poweredByHeader: false,
  // Shared hosting limits how many processes an account may start. `LOW_RESOURCE_BUILD=1 next build` builds with one worker and no parallel build processes.
  ...(process.env.LOW_RESOURCE_BUILD ? { experimental: { cpus: 1, webpackBuildWorker: false, parallelServerCompiles: false, parallelServerBuildTraces: false } } : {}),
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
