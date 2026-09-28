import { describe, expect, it } from "vitest";
import { rssXml, xmlEscape } from "../seo/rss";

describe("RSS", () => {
  it("글자를 XML로 이스케이프하고 제어 문자를 뺀다", () => {
    expect(xmlEscape(`감자전 & "막걸리" <좋음>\u0007`)).toBe("감자전 &amp; &quot;막걸리&quot; &lt;좋음&gt;");
  });
  it("채널·항목·self 링크·최신 날짜", () => {
    const x = rssXml({ title: "페어링GO", link: "https://a.b/", description: "d", selfUrl: "https://a.b/rss.xml" }, [
      { title: "A × B", link: "https://a.b/drinks/a", description: "설명", pubDate: new Date("2026-09-27T00:00:00Z"), guid: "today-2026-09-27" },
      { title: "C × D", link: "https://a.b/drinks/c", description: "설명", pubDate: new Date("2026-09-28T00:00:00Z"), guid: "today-2026-09-28" },
    ]);
    expect(x).toContain('<atom:link href="https://a.b/rss.xml" rel="self"');
    expect(x).toContain("<lastBuildDate>Mon, 28 Sep 2026 00:00:00 GMT</lastBuildDate>");
    expect(x.match(/<item>/g)).toHaveLength(2);
    expect(x).toContain("<title>A × B</title>");
  });
});
