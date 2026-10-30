import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: "*",
      allow: ["/", "/api/books/*/cover"],
      // private or personal screens, sign-in pages and the API are not for search results
      disallow: ["/api/", "/library", "/profile", "/wallet", "/orders", "/settings", "/support", "/notifications", "/checkout", "/payment", "/read/", "/sign-in", "/sign-up", "/forgot-password", "/reset-password", "/verify-email", "/admin"],
    }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
