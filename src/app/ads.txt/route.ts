// AdSense verifies your site through this file: https://yourdomain/ads.txt. It exists only once ADSENSE_CLIENT (ca-pub-…) is set.
export function GET() {
  const client = process.env.ADSENSE_CLIENT?.replace(/^ca-/, "");
  if (!client) return new Response("Not found", { status: 404 });
  return new Response(`google.com, ${client}, DIRECT, f08c47fec0942fa0\n`, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
