import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Tüm sayfalar taranabilir; yalnızca API uçları kapalı. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/api/",
    },
    // `Host` yalnızca Yandex'in 2018'de kaldırdığı bir yönergeydi ve çıplak alan adı beklerdi;
    // şema içeren bir değer geçersizdi, bu yüzden hiç yazılmıyor.
    sitemap: `${site.url}/sitemap.xml`,
  };
}
