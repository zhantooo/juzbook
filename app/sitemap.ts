import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://juzbook.kz",
      lastModified: new Date()
    }
  ];
}
