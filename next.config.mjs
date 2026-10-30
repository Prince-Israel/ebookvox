/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.DIST_DIR ?? ".next", // lets `next dev` use its own folder so it never overwrites a running production build
  serverExternalPackages: ["@prisma/client", "msedge-tts", "unpdf", "mammoth", "bcryptjs"],
  poweredByHeader: false,
  // Shared hosting limits how many processes an account may start. `LOW_RESOURCE_BUILD=1 next build` builds with one worker, no parallel build processes and no type-check/lint (those already run in our tests; they need the most memory).
  ...(process.env.LOW_RESOURCE_BUILD ? { experimental: { cpus: 1, webpackBuildWorker: false, parallelServerCompiles: false, parallelServerBuildTraces: false }, typescript: { ignoreBuildErrors: true }, eslint: { ignoreDuringBuilds: true } } : {}),
  async headers() {
    return [
      {
        // personal and sign-in screens must never appear in search results
        source: "/:path(library|profile|wallet|orders|settings|support|notifications|checkout|payment|read|sign-in|sign-up|forgot-password|reset-password|verify-email|admin)/:rest*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/:path(library|profile|wallet|orders|settings|support|notifications|payment|sign-in|sign-up|forgot-password|reset-password|verify-email|admin)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
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
