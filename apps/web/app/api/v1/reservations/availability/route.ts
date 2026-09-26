/** 예약 가능 시간 — ?kakao=카카오장소id&date=YYYY-MM-DD&party=2. 정원이 바로 바뀌므로 캐시하지 않는다 */
import { isDate, isPlaceId } from "@pairinggo/shared";
import { bookingContextByKakao, dayAvailability, isBookable } from "@pairinggo/server/reservations";
import { error, json, preflight } from "@/lib/http";
import { rateLimit } from "@/lib/kakao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function OPTIONS(req: Request) { return preflight(req); }

export async function GET(req: Request) {
  if (!rateLimit(req, 60, "availability")) return error(req, 429, "요청이 너무 많아요. 잠시 후 다시 시도해 주세요");
  const sp = new URL(req.url).searchParams;
  const kakao = (sp.get("kakao") || "").trim(), date = sp.get("date") || "";
  const party = Math.max(1, Math.min(50, Number(sp.get("party")) || 1));
  if (!isPlaceId(kakao) || !isDate(date)) return error(req, 400, "kakao·date 파라미터가 필요합니다");
  const ctx = await bookingContextByKakao(kakao);
  if (!ctx || !isBookable(ctx)) return json(req, { date, reason: "not_accepting", slots: [] }, { headers: NO_STORE });
  const day = await dayAvailability(ctx, date, new Date(), party);
  // 남은 팀 수는 "마감 임박" 표시에만 쓴다(인원 수는 내보내지 않음)
  return json(req, { date: day.date, reason: day.reason, slots: day.slots.map((s) => ({ time: s.time, available: s.available, few: s.available && s.remainingParties === 1 })) }, { headers: NO_STORE });
}
