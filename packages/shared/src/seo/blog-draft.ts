/**
 * 블로그 글 초안(2026-10-02) — 모음 화면(seo/guides.ts)의 순위를 네이버 블로그·티스토리에 올릴 글로 뽑는다. 어드민 `/admin/posts`가 쓴다.
 *  · 근거가 있는 조합만 쓴다(모음 화면과 같은 데이터). 줄마다 근거 표시와 출처 갈래를 붙인다.
 *  · **남의 글을 옮겨 적지 않는다** — 근거 글의 인용문(ev.quote)은 넣지 않고, 우리가 쓴 설명(reason)의 첫 문장과 출처 갈래("양조장 추천")만.
 *  · 링크에는 utm_source=blog를 붙여 대시보드 유입 경로에서 블로그로 잡히게 한다.
 * 그대로 올려도 되지만 초안이다 — 운영자가 사진과 한두 줄 감상을 더하는 것을 전제로 짧게 쓴다.
 */
import { josa } from "../hangul";
import type { GuideContent, GuideRow } from "./guides";
import { firstSentence, hashtags } from "./share-card";

export type BlogDraft = { title: string; body: string };
export const BLOG_DRAFT_TOP = 5;

/** 자동으로 채운 틀 문장 — 조사 병기(와(과))나 '… 근거'로 끝나는 설명 */
const BOILERPLATE = /\(과\)|\(와\)|\(이\)|\(가\)|후기·추천이 있는 조합|근거$/;

const CONF_WORD = { confirmed: "근거 확인", weak: "근거 약함" } as const;

function itemLines<A extends { name: string }, B extends { name: string }>(row: GuideRow<A, B>, i: number, withLabel: string): string[] {
  const best = row.with[0];
  // 설명은 짝 가운데 '읽을 만한' 첫 문장 — 자동으로 채운 틀 문장("○○와(과) 함께 즐긴 후기·추천이 있는 조합 — 매체 근거")은 글에 싣지 않는다
  const why = row.with.map((w) => (w.reason ? firstSentence(w.reason, 70) : "")).find((t) => t.length >= 8 && !BOILERPLATE.test(t)) ?? "";
  return [
    `${i + 1}. ${row.item.name}`,
    `${withLabel}: ${row.with.map((w) => w.item.name).join(", ")}`,
    ...(why ? [why] : []),
    `(${[best ? CONF_WORD[best.conf] : null, best?.src || null, `근거 조합 ${row.n}개`].filter(Boolean).join(" · ")})`,
    "",
  ];
}

/** 모음 화면 내용 → 블로그 글. n = 몇 가지를 실을지(기본 5) */
export function guideBlogDraft(c: GuideContent, base: string, n = BLOG_DRAFT_TOP): BlogDraft {
  const { def } = c;
  const isDrink = def.side === "drink";
  const rows = (isDrink ? c.foods : c.drinks).slice(0, n);
  const count = rows.length;
  const title = isDrink ? `${def.word} 안주 추천 ${count}가지 — 근거로 골랐어요` : `${def.word}에 어울리는 술 ${count}가지 — 근거로 골랐어요`;
  const intro = isDrink
    ? `${josa(def.word, "과/와")} 뭘 먹을지 고민될 때 보세요. 양조장·소믈리에·매체·후기가 실제로 짝지은 조합 ${def.n}개를 모아, 많이 겹친 음식 순으로 ${count}가지를 골랐습니다. 맛 분석으로 추정만 한 조합은 넣지 않았어요.`
    : `${def.word}에 어떤 술을 곁들일지 고민될 때 보세요. 양조장·소믈리에·매체·후기가 실제로 짝지은 조합 ${def.n}개를 모아, 많이 겹친 술 순으로 ${count}가지를 골랐습니다. 맛 분석으로 추정만 한 조합은 넣지 않았어요.`;
  const lines = [
    intro,
    "",
    ...(isDrink
      ? (rows as GuideContent["foods"]).flatMap((r, i) => itemLines(r, i, `어울리는 ${def.word}`))
      : (rows as GuideContent["drinks"]).flatMap((r, i) => itemLines(r, i, `어울리는 ${def.word}`))),
    `전체 순위와 조합마다의 근거·출처는 여기에서 볼 수 있어요.`,
    `${base}/guide/${def.slug}?utm_source=blog`,
    "",
    hashtags(["페어링고", "페어링GO", def.word, isDrink ? `${def.word}안주` : `${def.word}술`, ...rows.map((r) => r.item.name), isDrink ? "안주추천" : "술추천", "전통주"]),
    "",
    "주류는 만 19세 이상만 구매할 수 있습니다. 지나친 음주는 건강에 해롭습니다.",
  ];
  return { title, body: lines.join("\n") };
}
