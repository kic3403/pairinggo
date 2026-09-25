/**
 * 홈 배너·파트너 줄 데이터(2026-09-25) — home_banners(0036) + 승인 파트너(merchants·place_info.photos). 규칙은 shared/home/banners.ts.
 * DB가 없거나 실패하면 자동 카드(리포트·상시)만 돌려준다.
 */
import { DEFAULT_CARDS, activeBanners, bannerCards, cleanBanner, cleanPartnerKind, cleanStorePhotos, reportCard, type BannerCard, type BannerRow, type PartnerForBanner } from "@pairinggo/shared";
import { db } from "./db";

const need = () => { const sb = db(); if (!sb) throw new Error("DB 미설정"); return sb; };
/** 오늘(한국 날짜) YYYY-MM-DD */
export const kstToday = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
type Row = Record<string, unknown>;
const toRow = (r: Row): BannerRow => ({
  id: String(r.id), kind: (r.kind as BannerRow["kind"]) ?? "event", title: String(r.title ?? ""), subtitle: String(r.subtitle ?? ""), badge: String(r.badge ?? ""), cta: String(r.cta ?? "보기"), href: String(r.href ?? ""),
  tone: (r.tone as BannerRow["tone"]) ?? "navy", imageUrl: (r.image_url as string | null) ?? null, merchantId: (r.merchant_id as string | null) ?? null,
  startsOn: r.starts_on ? String(r.starts_on).slice(0, 10) : null, endsOn: r.ends_on ? String(r.ends_on).slice(0, 10) : null, sort: Number(r.sort ?? 0), active: r.active !== false,
});

/** 승인 파트너 — 이름·업종·카카오 id·대표 사진(매장 사진 → 술 사진 순). 사진 있는 곳 먼저 */
export async function partnerList(limit = 12): Promise<PartnerForBanner[]> {
  const sb = db(); if (!sb) return [];
  const { data: ms } = await sb.from("merchants").select("id,name,kind,kakao_place_id,approved_at").eq("status", "approved").order("approved_at", { ascending: false }).limit(60);
  const list = (ms ?? []).filter((m) => /^\d{3,20}$/.test(String(m.kakao_place_id)));
  if (!list.length) return [];
  const { data: pis } = await sb.from("place_info").select("kakao_id,photos,drink_items,menu_note").in("kakao_id", list.map((m) => String(m.kakao_place_id)));
  const byK = new Map((pis ?? []).map((p) => [String(p.kakao_id), p]));
  const out: PartnerForBanner[] = list.map((m) => {
    const pi = byK.get(String(m.kakao_place_id));
    const photos = cleanStorePhotos(pi?.photos);
    const drinkImg = (Array.isArray(pi?.drink_items) ? (pi!.drink_items as { img?: string }[]) : []).find((d) => d.img)?.img ?? null;
    return { id: String(m.id), name: String(m.name), kind: cleanPartnerKind(m.kind), kakaoId: String(m.kakao_place_id), photo: photos[0] ?? drinkImg, intro: (pi?.menu_note as string | null) ?? null };
  });
  return out.sort((a, b) => Number(!!b.photo) - Number(!!a.photo)).slice(0, limit);
}

export async function listBanners(): Promise<BannerRow[]> {
  const sb = db(); if (!sb) return [];
  const { data, error } = await sb.from("home_banners").select("*").order("sort").order("id");
  if (error) return [];
  return (data ?? []).map(toRow);
}

/** 홈 카드 — 리포트(자동) + 어드민 카드(기간 안) + 부족하면 상시 카드 */
export async function homeCards(): Promise<{ cards: BannerCard[]; partners: PartnerForBanner[] }> {
  const today = kstToday();
  try {
    const [rows, partners] = await Promise.all([listBanners(), partnerList()]);
    const byId = Object.fromEntries(partners.map((p) => [p.id, p]));
    return { cards: bannerCards(rows, today, byId), partners };
  } catch { return { cards: [reportCard(today), ...DEFAULT_CARDS], partners: [] }; }
}
/** 소식 전체(/events) — 오늘 보이는 카드 + 곧 시작할 이벤트 */
export async function allEventCards(): Promise<{ now: BannerCard[]; upcoming: BannerRow[] }> {
  const { cards } = await homeCards();
  const today = kstToday();
  const rows = await listBanners().catch(() => [] as BannerRow[]);
  const active = new Set(activeBanners(rows, today).map((r) => r.id));
  const upcoming = rows.filter((r) => r.active && r.startsOn && r.startsOn > today && !active.has(r.id)).sort((a, b) => a.startsOn!.localeCompare(b.startsOn!));
  return { now: cards, upcoming };
}

/** 어드민 저장 — id 있으면 수정, 없으면 추가. 저장 뒤 홈 캐시가 바로 갈리도록 카탈로그 버전은 건드리지 않고(배너는 카탈로그가 아니다) revalidate는 화면이 한다 */
export async function saveBanner(input: unknown): Promise<{ id: string } | { error: string }> {
  const sb = need();
  const o = (input ?? {}) as Record<string, unknown>;
  const { row, problem } = cleanBanner(o);
  if (problem) return { error: problem };
  if (row.merchantId) { const { data } = await sb.from("merchants").select("id").eq("id", row.merchantId).eq("status", "approved").maybeSingle(); if (!data) return { error: "승인된 파트너 매장이 아닙니다" }; }
  const rec = { kind: row.kind, title: row.title, subtitle: row.subtitle, badge: row.badge, cta: row.cta, href: row.href, tone: row.tone, image_url: row.imageUrl, merchant_id: row.merchantId, starts_on: row.startsOn, ends_on: row.endsOn, sort: row.sort, active: row.active, updated_at: new Date().toISOString() };
  const id = o.id ? Number(o.id) : null;
  if (id) { const { error } = await sb.from("home_banners").update(rec).eq("id", id); if (error) return { error: error.message }; return { id: String(id) }; }
  const { data, error } = await sb.from("home_banners").insert(rec).select("id").single();
  if (error) return { error: error.message };
  return { id: String(data.id) };
}
export async function deleteBanner(id: string): Promise<void> {
  const { error } = await need().from("home_banners").delete().eq("id", Number(id));
  if (error) throw new Error(error.message);
}
