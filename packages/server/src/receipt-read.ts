/**
 * 영수증 사진 읽기(2026-09-19, 리뷰 방문 인증) — 상호·사업자번호·전화·주소·날짜·시각·합계·승인번호만 읽는다.
 *  · 사진은 저장하지 않는다 — 한 번 읽고 버린다. 카드번호·이름 같은 개인정보는 읽지 않게 지시한다
 *  · 이 매장 것인지·30일 안인지는 shared receiptProblem, 같은 영수증 재사용은 receiptKey 해시로 가린다
 *  · 모델: claude-opus-5 구조화 출력(zod), 거절되면 서버 쪽 대체 모델로(fallbacks: "default") — 메뉴판 읽기와 같은 방식
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ReceiptRead } from "@pairinggo/shared";

export const receiptReadConfigured = () => !!process.env.ANTHROPIC_API_KEY;
/** base64 길이 상한 — 화면에서 긴 변 1,600px JPEG로 줄여 보낸다 */
export const RECEIPT_IMAGE_MAX_B64 = 4_000_000;

const Schema = z.object({
  is_receipt: z.boolean(),
  store_name: z.string(),
  biz_no: z.string(),
  phone: z.string(),
  address: z.string(),
  date: z.string(),
  time: z.string(),
  total: z.number().nullable(),
  approval_no: z.string(),
});

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const SYSTEM = `당신은 한국 식당 영수증(카드 전표·현금영수증·간이영수증·배달 앱 주문 내역 캡처 포함) 사진에서 방문 확인에 필요한 값만 옮기는 도우미입니다.
결과는 식당 리뷰의 "방문 인증"에 쓰이므로, 사진에 실제로 적힌 값만 정확히 옮기는 것이 가장 중요합니다. 보이지 않거나 흐린 값은 추측하지 말고 비워 두세요.

- is_receipt: 결제 영수증·전표로 보이면 true. 메뉴판·음식 사진·아무 글자 없는 사진이면 false.
- store_name: 가맹점명·상호(사업장명). 적힌 그대로.
- biz_no: 사업자등록번호(숫자 10자리, 하이픈 있어도 됨). 없으면 빈 문자열.
- phone: 가맹점 전화번호. 없으면 빈 문자열.
- address: 가맹점 주소. 없으면 빈 문자열.
- date: 거래(결제) 날짜를 YYYY-MM-DD로. 연도가 두 자리면 20을 붙입니다. 읽을 수 없으면 빈 문자열.
- time: 거래 시각을 HH:MM으로. 없으면 빈 문자열.
- total: 합계(결제) 금액을 원 단위 정수로. 없으면 null.
- approval_no: 카드 승인번호. 없으면 빈 문자열.
카드번호·고객 이름·회원번호 같은 개인정보는 어떤 칸에도 옮기지 마세요.`;

export async function readReceipt(image: { type: "image/jpeg"; data: string }): Promise<ReceiptRead> {
  const response = await anthropic().beta.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Schema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: image.type, data: image.data } },
        { type: "text", text: "이 영수증의 값을 읽어 주세요." },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("이 사진은 읽지 못했어요 — 영수증이 잘 보이게 다시 찍어 주세요");
  const o = response.parsed_output;
  if (!o) throw new Error("영수증을 읽지 못했어요 — 다시 시도해 주세요");
  const s = (v: string, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  return {
    isReceipt: !!o.is_receipt, storeName: s(o.store_name, 60), bizNo: s(o.biz_no, 20), phone: s(o.phone, 20), address: s(o.address, 120),
    date: /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : "", time: /^\d{1,2}:\d{2}/.test(o.time) ? o.time.slice(0, 5) : "",
    total: typeof o.total === "number" && Number.isFinite(o.total) && o.total >= 0 ? Math.round(o.total) : null,
    approvalNo: s(o.approval_no, 20),
  };
}

/** SDK 오류 → 화면 안내 */
export function receiptReadError(e: unknown): { status: number; error: string } {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, error: "잠시 요청이 많아요. 조금 뒤 다시 시도해 주세요" };
  if (e instanceof Anthropic.AuthenticationError) return { status: 503, error: "영수증 인증을 준비하고 있어요" };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, error: "사진을 읽지 못했어요. 다른 사진으로 시도해 주세요" };
  if (e instanceof Anthropic.APIError) return { status: 502, error: "AI 서버 오류예요. 잠시 뒤 다시 시도해 주세요" };
  return { status: 400, error: (e as Error).message };
}
