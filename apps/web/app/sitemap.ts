/** 사이트맵 — 술·음식 상세를 전부 실어 네이버·구글이 색인하게 한다. 기획 화면·회원 추천·리포트·음식 대분류·약관도(docs/20 P3-3). */
import type { MetadataRoute } from "next";
import { FOOD_GROUPS, toSlug } from "@pairinggo/shared";
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
    { url: `${base}/michelin`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/awards`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/hot`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/picks`, lastModified: now, changeFrequency: "daily", priority: 0.6 },
    { url: `${base}/report`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    ...FOOD_GROUPS.map((g) => ({ url: `${base}/foods?group=${encodeURIComponent(g.key)}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...c.dataset.drinks.map((d) => ({ url: `${base}/drinks/${encodeURIComponent(toSlug(d.name))}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...c.dataset.foods.map((f) => ({ url: `${base}/foods/${encodeURIComponent(toSlug(f.name))}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
