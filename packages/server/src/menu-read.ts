/**
 * 메뉴판 사진 읽기 — 어드민(/admin/places, 이름만 씀)과 파트너 앱(/store, 메뉴·술 표)이 함께 쓴다.
 *   메뉴: 음식명 · 간단한 설명 · 가격        술: 이름 · 용량 · 도수 · 가격
 *  · 서버 전용(ANTHROPIC_API_KEY). 키가 없으면 menuReadConfigured()가 false → 화면이 안내만 한다
 *  · 사진은 저장하지 않는다 — 요청 한 번에 읽고 버린다(매장 메뉴판 이미지의 권리는 매장에)
 *  · 메뉴판에 적혀 있지 않은 칸은 빈값으로 — 지어내지 않게 지시하고, shared cleanMenuItems·cleanDrinkItems가 한 번 더 정리한다
 *  · 카탈로그 이름을 함께 주고, 분명히 같은 술·음식일 때만 catalog_name에 적게 한다(지어낸 이름은 shared가 카탈로그와 대조해 걸러 냄)
 *  · 모델: claude-opus-5, 구조화 출력(zod), 거절되면 서버 쪽 대체 모델로 다시 시도(fallbacks: "default")
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { cleanVolume, parseAbv, parsePrice, type MenuReadRow } from "@pairinggo/shared";

export const menuReadConfigured = () => !!process.env.ANTHROPIC_API_KEY;

export const MENU_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type MenuImageType = (typeof MENU_IMAGE_TYPES)[number];
/** base64 길이 상한 — 화면에서 긴 변 1,600px JPEG로 줄여 보내므로 보통 0.3~0.8MB. 서버 본문 한도(4.5MB) 안쪽 */
export const MENU_IMAGE_MAX_B64 = 4_000_000;
export const MENU_IMAGES_MAX = 4;

const ReadSchema = z.object({
  items: z.array(z.object({
    kind: z.enum(["drink", "food", "beverage"]),
    name: z.string(),
    catalog_name: z.string().nullable(),
    description: z.string(),
    price: z.number().nullable(),
    volume: z.string(),
    abv: z.number().nullable(),
  })),
  note: z.string(),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

function systemPrompt(drinks: string[], foods: string[]) {
  return `당신은 한국 식당의 메뉴판 사진을 읽어 판매 중인 음식과 술을 표로 옮기는 도우미입니다. 결과는 전통주 페어링 서비스의 매장 메뉴판에 그대로 실리므로, 사진에 적힌 것만 정확히 옮기는 것이 가장 중요합니다.

규칙
- 사진에 실제로 적혀 있는 항목과 값만 적습니다. 보이지 않거나 흐려서 읽을 수 없는 글자는 추측하지 말고 비워 두세요.
- kind: 술(막걸리·약주·소주·맥주·와인·사케·위스키·하이볼·칵테일 등)은 "drink", 음식·안주는 "food", 술이 아닌 음료(음료수·차·커피·에이드·주스·식혜·수정과)는 "beverage". 물·공깃밥·추가 사리·세트 구성품 설명은 넣지 않습니다.
- name: 메뉴판에 적힌 이름. 가격·용량·도수는 이름에서 빼고 각 칸에 적습니다. 음식이 크기별(대/중/소)로 값이 다르면 "보쌈(대)", "보쌈(소)"처럼 크기를 이름 뒤 괄호에 붙여 줄을 나눕니다.
- description: 음식·음료 이름 아래나 옆에 적힌 짧은 설명(재료·조리법 등)을 60자 안으로. 적혀 있지 않으면 빈 문자열. 술은 빈 문자열.
- price: 원 단위 정수(12,000원 → 12000, 1.2만 → 12000). 시가·변동·가격이 적혀 있지 않으면 null.
- volume: 술의 용량을 적힌 대로(750ml, 1병, 잔, 500cc). 적혀 있지 않으면 빈 문자열. 음식은 빈 문자열. 같은 술이 잔·병으로 값이 다르면 줄을 나눕니다.
- abv: 술의 도수(%)를 숫자로(13% → 13). 메뉴판에 적혀 있을 때만 — 알고 있는 제품이라도 적혀 있지 않으면 null. 음식은 null.
- catalog_name: 아래 서비스 목록에 그 항목과 분명히 같은 술(같은 제품)이나 같은 음식이 있으면 목록에 적힌 이름을 글자 그대로, 아니면 null. 비슷하기만 한 것(그냥 "막걸리"와 특정 브랜드 막걸리, "소주"와 특정 증류주)은 null입니다.
- note: 사진이 메뉴판이 아니거나 거의 읽을 수 없으면 그 이유를 한 문장으로, 아니면 빈 문자열.

서비스의 술 목록:
${drinks.join(", ")}

서비스의 음식 목록:
${foods.join(", ")}`;
}

export type MenuReadResult = { items: MenuReadRow[]; note: string; model: string };

/** catalog: 카탈로그 술·음식 이름(요청마다 같은 순서로 — 지시문이 캐시된다) */
export async function readMenuImages(images: { type: MenuImageType; data: string }[], catalog: { drinks: string[]; foods: string[] }): Promise<MenuReadResult> {
  const response = await anthropic().beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(ReadSchema) },
    system: [{ type: "text", text: systemPrompt(catalog.drinks, catalog.foods), cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.type, data: img.data } })),
        { type: "text" as const, text: images.length > 1 ? `메뉴판 사진 ${images.length}장입니다. 모든 장의 음식과 술을 한 표로 읽어 주세요.` : "이 메뉴판 사진의 음식과 술을 읽어 주세요." },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("이 사진은 읽지 못했어요. 메뉴판이 잘 보이게 다시 찍어 주세요");
  if (response.stop_reason === "max_tokens") throw new Error("메뉴가 너무 많아요. 사진을 나눠서 올려 주세요");
  const out = response.parsed_output;
  if (!out) throw new Error("읽은 결과를 해석하지 못했어요. 다시 시도해 주세요");
  return {
    items: out.items.map((it) => ({
      kind: it.kind, name: it.name, catalogName: it.catalog_name,
      desc: it.kind !== "drink" ? it.description : "",
      price: parsePrice(it.price),
      volume: it.kind === "drink" ? cleanVolume(it.volume) : "",
      abv: it.kind === "drink" ? parseAbv(it.abv) : null,
    })),
    note: out.note,
    model: response.model,
  };
}

/** API 라우트 공용 — 요청 본문 검사. 문제가 있으면 [상태, 안내] */
export function checkMenuImages(raw: unknown): { ok: true; images: { type: MenuImageType; data: string }[] } | { ok: false; status: number; error: string } {
  const images = (Array.isArray((raw as { images?: unknown })?.images) ? (raw as { images: { type?: string; data?: string }[] }).images : []).slice(0, MENU_IMAGES_MAX);
  if (!images.length) return { ok: false, status: 400, error: "메뉴판 사진을 골라 주세요" };
  for (const img of images) {
    if (!MENU_IMAGE_TYPES.includes(img.type as MenuImageType) || typeof img.data !== "string" || !img.data) return { ok: false, status: 400, error: "JPG·PNG·WEBP 사진만 읽을 수 있어요" };
    if (img.data.length > MENU_IMAGE_MAX_B64) return { ok: false, status: 413, error: "사진이 너무 커요" };
  }
  return { ok: true, images: images as { type: MenuImageType; data: string }[] };
}

/** API 라우트 공용 — SDK 오류를 화면 안내로 */
export function menuReadError(e: unknown): { status: number; error: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: "잠시 요청이 많아요. 조금 뒤 다시 시도해 주세요" };
  if (e instanceof Anthropic.AuthenticationError) return { status: 503, error: "AI 키가 올바르지 않아요 — ANTHROPIC_API_KEY를 확인해 주세요" };
  if (e instanceof Anthropic.BadRequestError) { console.warn("[menu-read]", e.message); return { status: 400, error: "사진을 읽지 못했어요. 다른 사진으로 시도해 주세요" }; }
  if (e instanceof Anthropic.APIError) { console.warn("[menu-read]", e.status, e.message); return { status: 502, error: "AI 서버 오류예요. 잠시 뒤 다시 시도해 주세요" }; }
  return { status: 400, error: (e as Error).message };
}
