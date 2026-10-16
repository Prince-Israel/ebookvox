/** @type {import('next').NextConfig} */
// Shown on the Profile page so you can tell which release you are looking at.
const BUILD_ID = process.env.BUILD_ID ?? new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC";

const nextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
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
