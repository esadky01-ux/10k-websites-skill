import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/account", "/tr/hesap", "/inloggen", "/tr/giris", "/registreren", "/tr/kayit", "/beheer", "/tr/yonetim"] }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
