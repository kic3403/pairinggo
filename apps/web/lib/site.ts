/** 공개 웹 절대 URL — 사이트맵·canonical·OG에 쓴다. 배포 도메인이 정해지면 SITE_URL로 넣는다. */
export function siteUrl(): string {
  const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") || "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}
