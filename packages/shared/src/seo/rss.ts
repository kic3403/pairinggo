/**
 * RSS 2.0 피드(2026-09-28) — 네이버 서치어드바이저가 새 글을 모으는 입구(사이트맵과 함께 제출). /rss.xml이 오늘의 페어링을 싣는다.
 * 글자는 XML로 이스케이프하고, 제어 문자는 뺀다(피드 검사기가 거절한다).
 */
export type RssItem = { title: string; link: string; description: string; pubDate: Date; guid: string };
export type RssChannel = { title: string; link: string; description: string; selfUrl: string; language?: string };

export const xmlEscape = (s: string) => String(s ?? "")
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function rssXml(ch: RssChannel, items: RssItem[]): string {
  const last = items.reduce((m, x) => Math.max(m, x.pubDate.getTime()), 0);
  const item = (x: RssItem) => `    <item>
      <title>${xmlEscape(x.title)}</title>
      <link>${xmlEscape(x.link)}</link>
      <guid isPermaLink="false">${xmlEscape(x.guid)}</guid>
      <pubDate>${x.pubDate.toUTCString()}</pubDate>
      <description>${xmlEscape(x.description)}</description>
    </item>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(ch.title)}</title>
    <link>${xmlEscape(ch.link)}</link>
    <description>${xmlEscape(ch.description)}</description>
    <language>${ch.language ?? "ko"}</language>
    <atom:link href="${xmlEscape(ch.selfUrl)}" rel="self" type="application/rss+xml"/>
${last ? `    <lastBuildDate>${new Date(last).toUTCString()}</lastBuildDate>\n` : ""}${items.map(item).join("\n")}
  </channel>
</rss>
`;
}
