/**
 * 링크 공유 미리보기 이미지(OG 이미지) 공통 — 홈·술 상세·음식 상세의 opengraph-image.tsx가 쓴다(docs/20 P0-1).
 * 카톡·문자로 링크를 보내면 이 그림이 뜬다. 한글은 기본 폰트에 없어서 Google Fonts에서 Noto Sans KR을 필요한 글자만 받아 넣는다.
 * 폰트를 못 받으면(네트워크) 그림은 나오되 한글이 깨질 수 있어 배경·로고는 글자 없이도 뜻이 통하게 그린다.
 */
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
const NAVY = "#22406B", FOOD = "#E4572E", INK = "#1F1E1C", MUTED = "#6B6963", BG = "#FBFAF7";

const fontCache = new Map<string, Promise<ArrayBuffer | null>>();
/** Noto Sans KR 700 — text에 든 글자만 담은 TTF. Node fetch(브라우저 UA 없음)에는 구글이 truetype을 준다 */
export function loadKoreanFont(text: string): Promise<ArrayBuffer | null> {
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
