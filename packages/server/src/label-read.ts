/**
 * 라벨 사진 읽기(2026-09-26, docs/25 §5) — 비비노의 라벨 스캔에 해당. 술병·상자 사진에서 제품명·양조장·도수를 읽어 카탈로그와 대조한다.
 *  · 메뉴판 읽기(menu-read.ts)와 같은 Claude 호출(구조화 출력 zod), 사진은 저장하지 않는다
 *  · 카탈로그 술 이름 목록은 system에 넣어 캐시(요청마다 같은 순서)
 *  · 대조(카탈로그 검색)는 호출한 쪽(web lib/label-read.ts)이 shared search로 한다
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { MenuImageType } from "./menu-read";

export const labelReadConfigured = () => !!process.env.ANTHROPIC_API_KEY;

const LabelSchema = z.object({
  names: z.array(z.string()),
  brewery: z.string().nullable(),
  abv: z.number().nullable(),
  kind: z.string().nullable(),
  catalog_name: z.string().nullable(),
  note: z.string(),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

function systemPrompt(drinks: string[]) {
  return `당신은 술(전통주·위스키·사케·와인 등) 병이나 상자의 라벨 사진에서 제품 정보를 읽는 도우미입니다. 결과는 페어링 서비스가 그 술을 찾는 데 쓰이므로, 사진에 실제로 적힌 것만 정확히 옮기는 것이 가장 중요합니다.

규칙
- names: 라벨에 적힌 제품 이름 후보를 가장 확실한 것부터 최대 3개. 한글 표기가 있으면 한글, 영문만 있으면 영문 그대로. 양조장·회사 이름, 슬로건, "막걸리"·"약주"처럼 종류만 적힌 낱말은 제품명이 아닙니다. 제품명을 읽을 수 없으면 빈 배열.
- brewery: 양조장·제조사 이름이 적혀 있으면 그대로, 없으면 null.
- abv: 도수(%)가 적혀 있으면 숫자만(13% → 13), 없으면 null.
- kind: 종류 낱말(막걸리·약주·청주·소주·증류주·과실주·위스키·사케·와인 등)이 적혀 있으면 그대로, 없으면 null.
- catalog_name: 아래 서비스 목록에 그 제품과 분명히 같은 술이 있으면 목록에 적힌 이름을 글자 그대로, 아니면 null. 비슷하기만 한 것은 null.
- note: 사진이 술 라벨이 아니거나 거의 읽을 수 없으면 그 이유를 한 문장으로, 아니면 빈 문자열.

서비스의 술 목록:
${drinks.join(", ")}`;
}

export type LabelReadResult = { names: string[]; brewery: string | null; abv: number | null; kind: string | null; catalogName: string | null; note: string; model: string };

export async function readLabelImage(image: { type: MenuImageType; data: string }, drinks: string[]): Promise<LabelReadResult> {
  const response = await anthropic().beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(LabelSchema) },
    system: [{ type: "text", text: systemPrompt(drinks), cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image" as const, source: { type: "base64" as const, media_type: image.type, data: image.data } },
        { type: "text" as const, text: "이 술 라벨 사진의 제품 이름과 정보를 읽어 주세요." },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("이 사진은 읽지 못했어요. 라벨이 잘 보이게 다시 찍어 주세요");
  const out = response.parsed_output;
  if (!out) throw new Error("읽은 결과를 해석하지 못했어요. 다시 시도해 주세요");
  const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 60);
  return {
    names: [...new Set(out.names.map(clean).filter(Boolean))].slice(0, 3),
    brewery: out.brewery ? clean(out.brewery) || null : null,
    abv: out.abv != null && Number.isFinite(out.abv) && out.abv > 0 && out.abv < 100 ? out.abv : null,
    kind: out.kind ? clean(out.kind) || null : null,
    catalogName: out.catalog_name ? clean(out.catalog_name) || null : null,
    note: out.note.trim(),
    model: response.model,
  };
}
