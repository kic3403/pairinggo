/**
 * 링크 공유 미리보기 이미지(OG 이미지) 공통 — 홈·술 상세·음식 상세의 opengraph-image.tsx가 쓴다(docs/20 P0-1).
 * 카톡·문자로 링크를 보내면 이 그림이 뜬다. 한글은 기본 폰트에 없어서 번들한 Noto Sans KR 부분집합(lib/fonts, packages/db og-font로 생성)을 쓴다.
 * 처음엔 Google Fonts에서 요청 때 받았는데 첫 생성이 5초를 넘겨 카카오 스크래퍼가 그림을 못 받았다(2026-09-15) — 번들 폰트를 못 읽을 때만 그 방법으로 간다.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
const NAVY = "#22406B", FOOD = "#E4572E", INK = "#1F1E1C", MUTED = "#6B6963", BG = "#FBFAF7";

let localFont: Promise<ArrayBuffer | null> | null = null;
/** 번들한 Noto Sans KR 700 부분집합(KS X 1001 2,350자 + 카탈로그 글자, packages/db og-font) — 요청 때 밖에서 받지 않아 첫 생성이 빠르다 */
function loadLocalFont(): Promise<ArrayBuffer | null> {
  if (!localFont) {
    localFont = (async () => {
      try {
        const buf = await readFile(join(process.cwd(), "lib", "fonts", "NotoSansKR-Bold-ko.ttf"));
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      } catch { return null; }
    })();
  }
  return localFont;
}

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
/** 예비: 번들 폰트를 못 읽을 때 Google Fonts에서 text에 든 글자만 받은 TTF. Node fetch(브라우저 UA 없음)에는 구글이 truetype을 준다 */
function loadGoogleFont(text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text + "페어링GO전통주에어울리는음식·%0123456789")].join("");
  const key = chars.split("").sort().join("");
  if (!fontCache.has(key)) {
    fontCache.set(key, (async () => {
      try {
        const css = await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(chars)}`, { signal: AbortSignal.timeout(4000) }).then((r) => r.text());
        const url = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)?.[1];
        if (!url) return null;
        return await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer());
      } catch { return null; }
    })());
  }
  return fontCache.get(key)!;
}

export async function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
  return (await loadLocalFont()) ?? loadGoogleFont(text);
}

export type OgCard = {
  /** 작은 윗줄 — 예: "전통주 · 탁주 · 6.5%" */
  kicker: string;
  /** 큰 제목 — 술·음식 이름 */
  title: string;
  /** 어울리는 것 3개 — 칩으로 */
  chips: string[];
  /** 아래 설명 한 줄 */
  note: string;
  /** 칩 색 — 술 상세는 음식(주황), 음식 상세는 술(남색) */
  accent?: "food" | "drink";
};

export async function ogImage(card: OgCard) {
  const text = [card.kicker, card.title, ...card.chips, card.note].join("");
  const font = await loadKoreanFont(text);
  const accent = card.accent === "food" ? FOOD : NAVY;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, padding: "56px 64px", fontFamily: "NotoSansKR", color: INK }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex" }}>
            <div style={{ width: 34, height: 34, borderRadius: 17, background: NAVY }} />
            <div style={{ width: 34, height: 34, borderRadius: 17, background: FOOD, marginLeft: -12, opacity: 0.92 }} />
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>
            <span>페어링</span><span style={{ color: FOOD }}>GO</span>
          </div>
          <div style={{ fontSize: 24, color: MUTED, marginLeft: 8 }}>{card.kicker}</div>
        </div>
        <div style={{ display: "flex", fontSize: card.title.length > 12 ? 64 : 84, fontWeight: 700, letterSpacing: -2, marginTop: 44, lineHeight: 1.15 }}>{card.title}</div>
        <div style={{ display: "flex", gap: 14, marginTop: 34, flexWrap: "wrap" }}>
          {card.chips.slice(0, 3).map((c) => (
            <div key={c} style={{ display: "flex", padding: "12px 26px", borderRadius: 999, background: accent, color: "#fff", fontSize: 34, fontWeight: 700 }}>{c}</div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 26, color: MUTED }}>{card.note}</div>
      </div>
    ),
    { ...OG_SIZE, fonts: font ? [{ name: "NotoSansKR", data: font, weight: 700, style: "normal" }] : [] },
  );
}
