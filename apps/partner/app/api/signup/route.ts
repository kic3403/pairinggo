import { cookies } from "next/headers";
import { rateLimit, searchPlaces } from "@pairinggo/server/kakao";
import type { PartnerSignupInput } from "@pairinggo/shared";
import { applyPartner } from "@/lib/partner";
import { PENDING_COOKIE, readPending } from "@/lib/oauth";
import { authConfigured, COOKIE, cookieOptions, issueToken } from "@/lib/session";

/** 가입 신청 — 매장 이름·주소는 브라우저 값을 믿지 않고 카카오에서 그 장소 id를 다시 찾아 저장한다 */
export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: "가입 설정이 아직 없어요" }, { status: 503 });
  if (!rateLimit(req, 5, "partner-signup")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as PartnerSignupInput & { placeName?: string; social?: boolean };
  const jar = await cookies();
  // 카카오·네이버로 들어온 가입 — 서명된 대기 쿠키가 있어야(15분)
  const social = b.social ? readPending(jar.get(PENDING_COOKIE)?.value) : null;
  if (b.social && !social) return Response.json({ error: "간편로그인 시간이 지났어요 — 로그인 화면에서 다시 시작해 주세요" }, { status: 400 });
  const found = await searchPlaces({ query: String(b.placeName ?? "").slice(0, 40), pages: 2 }).catch(() => null);
  const place = found?.places.find((p) => p.id === String(b.kakaoPlaceId ?? ""));
  if (!place) return Response.json({ error: "매장을 다시 검색해서 골라 주세요" }, { status: 400 });
  const r = await applyPartner(b, {
    name: place.name, address: place.roadAddress || place.address, phone: place.phone ?? "", lat: place.lat, lng: place.lng, placeUrl: place.placeUrl,
  }, social);
  if (!r.ok) return Response.json({ error: r.problem }, { status: 400 });
  if (social) jar.delete(PENDING_COOKIE);
  jar.set(COOKIE, issueToken(r.id, r.passwordHash), cookieOptions);
  return Response.json({ ok: true });
}
