/** 사이트맵 — 술·음식 상세를 전부 실어 네이버·구글이 색인하게 한다. */
import type { MetadataRoute } from "next";
import { toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getCatalog();
  const now = new Date();
  const base = siteUrl();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/drinks`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/foods`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    ...c.dataset.drinks.map((d) => ({ url: `${base}/drinks/${encodeURIComponent(toSlug(d.name))}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...c.dataset.foods.map((f) => ({ url: `${base}/foods/${encodeURIComponent(toSlug(f.name))}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
