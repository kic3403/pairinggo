/**
 * 어드민 왼쪽 메뉴 알림 숫자(2026-09-29 사용자 요청) — 운영자가 처리할 일이 있는 메뉴 옆에 빨간 숫자.
 * 어드민 화면마다 부르므로 가벼운 개수 조회(head count)만, 실패한 항목은 0(메뉴가 깨지지 않게).
 */
import { openErrorCount } from "@pairinggo/server/errors";
import { db } from "./db";

export type AdminBadge = { n: number; title: string };
export type AdminBadges = Partial<Record<string, AdminBadge>>;

export async function adminBadges(): Promise<AdminBadges> {
  const sb = db();
  if (!sb) return {};
  const count = async (q: PromiseLike<{ count: number | null }>) => { try { return (await q).count ?? 0; } catch { return 0; } };
  const head = { count: "exact" as const, head: true };
  const lastPub = await sb.from("catalog_meta").select("updated_at").eq("key", "version").maybeSingle().then((r) => (r.data?.updated_at as string | undefined) ?? null, () => null);
  const [aiYes, promoted, wanted, picks, experts, partners, reviews, sellers, errors] = await Promise.all([
    count(sb.from("pairing_candidates").select("id", head).eq("status", "draft").eq("ai_verdict", "yes")),
    lastPub ? count(sb.from("pairing_candidates").select("id", head).eq("status", "promoted").gt("reviewed_at", lastPub)) : Promise.resolve(0),
    count(sb.from("drink_requests").select("id", head).eq("status", "open")),
    count(sb.from("member_picks").select("id", head).eq("status", "review")),
    count(sb.from("experts").select("user_id", head).eq("status", "applied")),
    count(sb.from("merchants").select("id", head).eq("status", "applied")),
    count(sb.from("place_reviews").select("id", head).eq("status", "hidden").like("hidden_reason", "%검토 대기%")),
    count(sb.from("sellers").select("id", head).eq("status", "applied")),
    openErrorCount().catch(() => 0),
  ]);
  const b = (n: number, title: string): AdminBadge | undefined => (n > 0 ? { n, title } : undefined);
  return {
    "/admin/review": b(aiYes, `AI가 확인한 근거 후보 ${aiYes}건 검수 대기`),
    "/admin/publish": b(promoted, `승격 뒤 아직 발행하지 않은 조합 ${promoted}건`),
    "/admin/wanted": b(wanted, `회원이 요청한 술 ${wanted}건 처리 대기`),
    "/admin/picks": b(picks, `회원 추천 ${picks}건 검수 대기`),
    "/admin/experts": b(experts, `전문가 등급 요청 ${experts}건 심사 대기`),
    "/admin/partners": b(partners, `파트너 가입 신청 ${partners}건 승인 대기`),
    "/admin/place-reviews": b(reviews, `신고로 숨겨진 식당 리뷰 ${reviews}건 검토 대기`),
    "/admin/shop": b(sellers, `판매 입점 신청 ${sellers}건 승인 대기`),
    "/admin/errors": b(errors, `최근 24시간 운영 오류 ${errors}건`),
  };
}
