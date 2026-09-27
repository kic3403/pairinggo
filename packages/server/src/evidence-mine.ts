/**
 * 근거 늘리기 — Claude 판정 두 가지(2026-09-27, docs/26 §3-5 3단계). 앞뒤 규칙(대목 고르기·인용 확인)은 shared pairing/evidence-mine.ts.
 *   ① judgeCoMentions: 후보 글에서 술과 음식이 함께 나오는 대목을 읽고 "이 글이 그 술과 그 음식이 어울린다고 말하는가"를 음식마다 판정
 *   ② extractOfficialPairings: 양조장 공식 페이지의 추천 낱말 대목에서 그 술에 추천하는 음식과 그 문장을 뽑는다
 * 두 경우 모두 인용문은 대목에서 글자 그대로 복사하게 하고, 호출한 쪽이 원문과 다시 대조한다(finalizeMine).
 * 음식 목록(카탈로그 이름)은 system에 넣어 캐시한다. 사진·원문은 저장하지 않는다.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const evidenceMineConfigured = () => !!process.env.ANTHROPIC_API_KEY;
export const MINE_MODEL_DEFAULT = "claude-opus-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export type MineUsage = { input: number; output: number; cacheRead: number; cacheWrite: number; calls: number };
export const emptyUsage = (): MineUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, calls: 0 });
function addUsage(u: MineUsage | undefined, r: { usage?: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } }) {
  if (!u || !r.usage) return;
  u.input += r.usage.input_tokens ?? 0; u.output += r.usage.output_tokens ?? 0;
  u.cacheRead += r.usage.cache_read_input_tokens ?? 0; u.cacheWrite += r.usage.cache_creation_input_tokens ?? 0; u.calls++;
}

/* ---------- ① 후보 글 판정 ---------- */

const JudgeSchema = z.object({
  items: z.array(z.object({
    food: z.string(),
    verdict: z.enum(["yes", "no", "unclear"]),
    quote: z.string(),
    reason: z.string(),
    ad: z.boolean(),
  })),
});

const JUDGE_SYSTEM = `당신은 한국어 글(블로그·카페·뉴스·유튜브 설명)을 읽고, 특정 술과 특정 음식이 "어울린다"는 근거가 그 글에 실제로 있는지 판정하는 검수 도우미입니다.
판정 결과는 술·음식 페어링 서비스의 근거로 쓰이므로, 글에 적힌 것만 보고 엄격하게 판단합니다. 애매하면 yes가 아닙니다.

음식마다 verdict
- yes: 글쓴이(또는 글이 인용한 양조장·전문가)가 바로 그 술을 그 음식과 함께 먹었더니 좋았다·어울렸다고 하거나, 그 술의 안주·페어링으로 그 음식을 추천·소개한다.
- no: 두 이름이 같은 글에 나오기만 한다(메뉴판·가게 소개·여러 술이나 음식을 늘어놓은 목록·장보기 목록), 다른 술 이야기다(이름이 비슷한 다른 제품·같은 양조장의 다른 술), 어울리지 않았다고 한다, 음식이 술과 상관없는 맥락이다.
- unclear: 함께 먹은 것 같지만 어울렸는지 말이 없거나, 어느 술 이야기인지 분명하지 않거나, 먹어 보지 않고 추측만 한다("~와도 어울릴 것 같다").

quote: 판정의 근거가 된 문장을 주어진 대목에서 글자 그대로 복사합니다(요약·고쳐 쓰기·말줄임 금지, 150자 이내, 가능하면 음식 이름을 포함한 한 문장). no면 빈 문자열.
reason: yes일 때만 — 카드에 보일 추천 이유 초안 한 문장(40자 이내). 글에 적힌 내용(맛·식감·분위기)만 옮기고 지어내지 않습니다. 이유가 글에 없으면 "함께 즐겼다는 후기"처럼 사실만. yes가 아니면 빈 문자열.
ad: 글에 협찬·광고·체험단·원고료·제품 제공 표시가 보이면 true.
food: 주어진 음식 이름을 그대로 적습니다. 주어진 음식마다 한 줄씩 빠짐없이 답합니다.`;

export type JudgeInput = {
  drink: { name: string; brewery?: string | null; category?: string | null; abv?: number | null };
  foods: string[];
  excerpts: string[];
  kind: string;
  title?: string | null;
};
export type JudgeOut = { food: string; verdict: "yes" | "no" | "unclear"; quote: string; reason: string; ad: boolean };

export async function judgeCoMentions(input: JudgeInput, opts: { model?: string; usage?: MineUsage } = {}): Promise<{ items: JudgeOut[]; model: string }> {
  const d = input.drink;
  const head = [
    `술: ${d.name}${[d.brewery, d.category, d.abv != null ? `${d.abv}%` : null].filter(Boolean).length ? ` (${[d.brewery, d.category, d.abv != null ? `${d.abv}%` : null].filter(Boolean).join(" · ")})` : ""}`,
    `판정할 음식: ${input.foods.join(", ")}`,
    `글 종류: ${input.kind}`,
    input.title ? `글 제목: ${input.title}` : "",
  ].filter(Boolean).join("\n");
  const body = input.excerpts.map((x, i) => `[대목 ${i + 1}]\n${x}`).join("\n\n");
  const response = await anthropic().beta.messages.parse({
    model: opts.model ?? MINE_MODEL_DEFAULT,
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(JudgeSchema) },
    system: [{ type: "text", text: JUDGE_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${head}\n\n${body}` }],
  });
  addUsage(opts.usage, response);
  if (response.stop_reason === "refusal") throw new Error("refusal");
  const out = response.parsed_output;
  if (!out) throw new Error("parse failed");
  return { items: out.items, model: response.model };
}

/* ---------- ② 양조장 공식 페이지 추천 안주 ---------- */

const OfficialSchema = z.object({
  about_this_drink: z.boolean(),
  items: z.array(z.object({
    food_text: z.string(),
    catalog_food: z.string().nullable(),
    quote: z.string(),
    reason: z.string(),
  })),
});

function officialSystem(foods: string[]) {
  return `당신은 양조장 공식 홈페이지·공식몰의 제품 소개 글에서 "이 술에 어울리는 음식(추천 안주·페어링)"을 뽑는 도우미입니다. 결과는 페어링 서비스의 공식 근거가 되므로, 페이지에 적힌 것만 정확히 옮깁니다.

규칙
- about_this_drink: 주어진 대목이 바로 그 술(이름·도수·종류가 맞는 제품)의 소개이면 true. 같은 양조장의 다른 제품 이야기뿐이면 false이고 items는 빈 배열.
- items: 그 술에 어울린다고 페이지가 직접 추천한 음식만. 일반론("전통주는 한식과 잘 어울린다"), 다른 제품의 추천, 요리 재료·원료 설명은 넣지 않습니다.
  · food_text: 페이지에 적힌 음식 이름 그대로(예: "해물파전", "치즈").
  · catalog_food: 아래 서비스 음식 목록에 같은 음식이 있으면 목록의 이름을 글자 그대로, 넓은 말(예: "한식", "고기 요리")이거나 목록에 없으면 null.
  · quote: 추천이 적힌 문장을 대목에서 글자 그대로 복사(150자 이내, 요약·고쳐 쓰기 금지, food_text를 포함).
  · reason: 카드 추천 이유 초안 한 문장(40자 이내) — 페이지에 적힌 이유(맛·식감)만, 없으면 "양조장이 추천하는 안주".

서비스 음식 목록:
${foods.join(", ")}`;
}

export type OfficialOut = { food_text: string; catalog_food: string | null; quote: string; reason: string };

export async function extractOfficialPairings(input: { drink: { name: string; brewery?: string | null; category?: string | null; abv?: number | null }; excerpts: string[]; url: string }, foods: string[], opts: { model?: string; usage?: MineUsage } = {}): Promise<{ aboutThisDrink: boolean; items: OfficialOut[]; model: string }> {
  const d = input.drink;
  const head = `술: ${d.name} (${[d.brewery, d.category, d.abv != null ? `${d.abv}%` : null].filter(Boolean).join(" · ")})\n페이지: ${input.url}`;
  const body = input.excerpts.map((x, i) => `[대목 ${i + 1}]\n${x}`).join("\n\n");
  const response = await anthropic().beta.messages.parse({
    model: opts.model ?? MINE_MODEL_DEFAULT,
    max_tokens: 1500,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(OfficialSchema) },
    system: [{ type: "text", text: officialSystem(foods), cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: `${head}\n\n${body}` }],
  });
  addUsage(opts.usage, response);
  if (response.stop_reason === "refusal") throw new Error("refusal");
  const out = response.parsed_output;
  if (!out) throw new Error("parse failed");
  return { aboutThisDrink: out.about_this_drink, items: out.about_this_drink ? out.items : [], model: response.model };
}
