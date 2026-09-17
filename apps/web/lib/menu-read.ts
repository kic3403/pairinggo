/**
 * 메뉴판 사진 읽기(2026-09-17) — 어드민 식당 정보 입력에서 메뉴판 사진을 올리면 Claude가 술·음식 이름을 읽어 목록으로 돌려준다.
 *  · 서버 전용(ANTHROPIC_API_KEY). 키가 없으면 menuReadConfigured()가 false → 화면이 안내만 한다
 *  · 사진은 저장하지 않는다 — 요청 한 번에 읽고 버린다(매장 메뉴판 이미지의 권리는 매장에)
 *  · 카탈로그 술·음식 이름을 함께 주고, 메뉴판 항목이 분명히 같은 술·음식일 때만 그 이름을 catalogName에 적게 한다.
 *    지어낸 이름은 shared mergeMenuRead가 카탈로그와 대조해 걸러 낸다
 *  · 모델: claude-opus-5, 구조화 출력(zod), 거절되면 서버 쪽 대체 모델로 다시 시도(fallbacks: "default")
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { MenuReadItem } from "@pairinggo/shared";
import { getCatalog } from "./catalog";

export const menuReadConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export const MENU_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type MenuImageType = (typeof MENU_IMAGE_TYPES)[number];
/** base64 길이 상한 — 화면에서 긴 변 1,600px JPEG로 줄여 보내므로 보통 0.3~0.8MB. 서버 본문 한도(4.5MB) 안쪽 */
export const MENU_IMAGE_MAX_B64 = 4_000_000;
export const MENU_IMAGES_MAX = 4;

const ReadSchema = z.object({
  items: z.array(z.object({
    kind: z.enum(["drink", "food"]),
    name: z.string(),
    catalog_name: z.string().nullable(),
  })),
  note: z.string(),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

function systemPrompt(drinks: string[], foods: string[]) {
  return `당신은 한국 식당의 메뉴판 사진을 읽어 판매 중인 술과 음식 목록을 만드는 도우미입니다. 결과는 전통주 페어링 서비스의 식당 정보에 들어갑니다.

규칙
- 사진에 실제로 적혀 있는 항목만 적습니다. 보이지 않거나 흐려서 읽을 수 없는 글자는 추측하지 말고 빼세요.
- kind: 마실 술(막걸리·약주·소주·맥주·와인·사케·위스키·하이볼 등)은 "drink", 음식·안주는 "food". 음료수·물·공깃밥·추가 사리·세트 구성 설명은 넣지 않습니다.
- name: 메뉴판에 적힌 이름에서 가격·용량(750ml, 1병)·크기(大/中/小)·괄호 설명만 뺀 짧은 이름. 같은 메뉴가 크기별로 여러 번 나오면 한 번만.
- catalog_name: 아래 서비스 목록에 그 항목과 분명히 같은 술(같은 제품)이나 같은 음식이 있으면 목록에 적힌 이름을 글자 그대로 적고, 아니면 null. 비슷하기만 한 것(예: 그냥 "막걸리"와 특정 브랜드 막걸리, "소주"와 특정 증류주)은 null입니다.
- note: 사진이 메뉴판이 아니거나 거의 읽을 수 없으면 그 이유를 한 문장으로, 아니면 빈 문자열.

서비스의 술 목록:
${drinks.join(", ")}

서비스의 음식 목록:
${foods.join(", ")}`;
}

export type MenuReadResult = { items: MenuReadItem[]; note: string; model: string };

export async function readMenuImages(images: { type: MenuImageType; data: string }[]): Promise<MenuReadResult> {
  const c = await getCatalog();
  const response = await anthropic().beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReadSchema) },
    // 카탈로그 목록이 들어간 지시문은 요청마다 같다 — 캐시해 두 번째부터 싸게
    system: [{ type: "text", text: systemPrompt(c.dataset.drinks.map((d) => d.name), c.dataset.foods.map((f) => f.name)), cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.type, data: img.data } })),
        { type: "text" as const, text: images.length > 1 ? `메뉴판 사진 ${images.length}장입니다. 모든 장의 술과 음식을 한 목록으로 읽어 주세요.` : "이 메뉴판 사진의 술과 음식을 읽어 주세요." },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("이 사진은 읽지 못했어요. 메뉴판이 잘 보이게 다시 찍어 주세요");
  if (response.stop_reason === "max_tokens") throw new Error("메뉴가 너무 많아요. 사진을 나눠서 올려 주세요");
  const out = response.parsed_output;
  if (!out) throw new Error("읽은 결과를 해석하지 못했어요. 다시 시도해 주세요");
  return {
    items: out.items.map((it) => ({ kind: it.kind, name: it.name, catalogName: it.catalog_name })),
    note: out.note,
    model: response.model,
  };
}
