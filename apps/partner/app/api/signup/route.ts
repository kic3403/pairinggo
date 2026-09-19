import { cookies } from "next/headers";
import { rateLimit, searchPlaces } from "@pairinggo/server/kakao";
import { cleanManualPlace, type PartnerSignupInput } from "@pairinggo/shared";
import { applyPartner, type PlacePick } from "@/lib/partner";
import { PENDING_COOKIE, readPending } from "@/lib/oauth";
import { authConfigured, COOKIE, cookieOptions, issueToken } from "@/lib/session";

/** 가입 신청 — 카카오에서 고른 매장은 브라우저 값을 믿지 않고 그 장소 id를 다시 찾아 저장한다. 직접 입력한 매장은 적은 값 그대로(운영자 승인 때 확인) */
export async function POST(req: Request) {
  if (!authConfigured()) return Response.json({ error: "가입 설정이 아직 없어요" }, { status: 503 });
  if (!rateLimit(req, 5, "partner-signup")) return Response.json({ error: "잠시 뒤 다시 시도해 주세요" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as PartnerSignupInput & { placeName?: string; social?: boolean };
  const jar = await cookies();
  // 카카오·네이버로 들어온 가입 — 서명된 대기 쿠키가 있어야(15분)
  const social = b.social ? readPending(jar.get(PENDING_COOKIE)?.value) : null;
  if (b.social && !social) return Response.json({ error: "간편로그인 시간이 지났어요 — 로그인 화면에서 다시 시작해 주세요" }, { status: 400 });
  let pick: PlacePick;
  if (!String(b.kakaoPlaceId ?? "").trim() && b.manualPlace) {
    // 검색이 안 되는 매장 — 사장님이 적은 상호·주소·전화(좌표 없음). 운영자가 승인할 때 카카오맵 장소를 찾아 연결한다
    const mp = cleanManualPlace(b.manualPlace);
    if (!mp.ok) return Response.json({ error: mp.problem }, { status: 400 });
    pick = { name: mp.value.name, address: mp.value.address, phone: mp.value.phone, lat: null, lng: null, placeUrl: null };
  } else {
    if (!String(b.kakaoPlaceId ?? "").trim()) return Response.json({ error: "매장을 검색해서 고르거나, 검색이 안 되면 직접 입력해 주세요" }, { status: 400 });
    const found = await searchPlaces({ query: String(b.placeName ?? "").slice(0, 40), pages: 2 }).catch(() => null);
    const place = found?.places.find((p) => p.id === String(b.kakaoPlaceId ?? ""));
    if (!place) return Response.json({ error: "매장을 다시 검색해서 골라 주세요" }, { status: 400 });
    pick = { name: place.name, address: place.roadAddress || place.address, phone: place.phone ?? "", lat: place.lat, lng: place.lng, placeUrl: place.placeUrl };
  }
  const r = await applyPartner(b, pick, social);
  if (!r.ok) return Response.json({ error: r.problem }, { status: 400 });
  if (social) jar.delete(PENDING_COOKIE);
  jar.set(COOKIE, issueToken(r.id, r.passwordHash), cookieOptions);
  return Response.json({ ok: true });
}
