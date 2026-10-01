/**
 * 공유용 그림 카드·글(2026-10-01) — 오늘의 페어링·월간 리포트를 인스타·블로그에 바로 올릴 수 있게.
 * 그림은 웹 `lib/og.tsx shareCardImage`(1080×1350, 인스타 4:5)가 그리고, 여기는 글자 규칙만.
 */

/** 카드에 넣을 글 자르기 — 넘치면 말줄임표. 낱말 중간에서 끊지 않으려 마지막 공백에서 자른다(너무 앞이면 그냥 자름) */
export function clipText(text: string, max: number): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp >= max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,.·\s]+$/, "") + "…";
}

/** 우리 설명의 첫 문장만 — 카드·글에 길게 싣지 않는다. 화살표 기호(↔ 등)는 그림에서 이모지로 깨져 가운뎃점으로 */
export function firstSentence(text: string, max = 60): string {
  const t = (text || "").replace(/[\u2190-\u21FF]\uFE0F?/g, "·").replace(/\s+/g, " ").trim();
  const m = t.match(/^.+?[.!?。](?=\s|$)/);
  return clipText(m ? m[0] : t, max);
}

/** 해시태그 — 띄어쓰기·기호를 빼고 중복 없이 */
export function hashtags(words: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    const k = (w || "").replace(/[^0-9A-Za-z가-힣]/g, "");
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(`#${k}`);
  }
  return out.join(" ");
}

export type TodayCaptionInput = {
  /** "10월 1일 (목)" */
  dateLabel: string; headline: string;
  drink: string; drinkMeta?: string; food: string;
  /** "근거 확인 · 출처 2곳" */
  confidence: string;
  /** 근거 글에서 따온 인용문(따옴표를 붙인다)과 출처 — 없으면 우리 설명 reason의 첫 문장을 따옴표 없이 */
  quote?: string; who?: string; reason?: string;
  category?: string;
  /** 사이트 주소(끝에 / 없음) */
  base: string;
};

/** 오늘의 페어링 SNS 글 — 인용문은 짧게, 출처와 주소를 붙인다 */
export function todayCaption(x: TodayCaptionInput): string {
  const rows = [
    `오늘의 페어링 · ${x.dateLabel}`,
    `${x.drink} × ${x.food}`,
    x.drinkMeta ? x.drinkMeta : null,
    "",
    x.quote ? `“${clipText(x.quote, 90)}”${x.who ? ` — ${x.who}` : ""}` : x.reason ? firstSentence(x.reason) : null,
    `${x.headline} · ${x.confidence}`,
    "",
    `근거와 함께 보기 → ${x.base}/today`,
    "",
    hashtags(["페어링GO", "오늘의페어링", x.drink, x.food, x.category, "전통주", "안주추천", "술안주"]),
    "주류는 만 19세 이상만. 지나친 음주는 건강에 해롭습니다.",
  ];
  return rows.filter((r) => r !== null).join("\n").replace(/\n{3,}/g, "\n\n");
}
