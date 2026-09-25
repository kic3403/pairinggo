/**
 * 홈 배너(2026-09-25, 캐치테이블·데일리샷식 카드 캐러셀) — 운영자가 어드민에서 만드는 카드 + 자동 카드(트렌드 리포트).
 *  · kind: event(시즌·월별·계절 이벤트, 기간 있음) · partner(이달의 파트너 양조장/매장 — merchant를 골라 그 매장 사진·이름으로) · report(자동) · custom(상시 안내)
 *  · 기간 밖·꺼진 카드는 `activeBanners`가 뺀다(한국 날짜 기준 — 오늘 날짜는 부르는 쪽이 넘긴다).
 *  · 링크는 사이트 안 주소(/…)만. 사진은 우리 저장소 공개 주소만(파트너 사진 재사용).
 *  · 참고 앱의 사진·문구는 쓰지 않는다 — 구조만 참고.
 */
export { PARTNER_KIND_LABEL, type PartnerKind } from "../reservation/partner";
export type BannerKind = "event" | "partner" | "report" | "custom";
export const BANNER_KINDS: BannerKind[] = ["event", "partner", "report", "custom"];
export const BANNER_KIND_LABEL: Record<BannerKind, string> = { event: "이벤트", partner: "이달의 파트너", report: "트렌드 리포트", custom: "상시 안내" };
/** 카드 색 — 기존 토큰에서 파생(site.css .bn.tone-*) */
export const BANNER_TONES = ["navy", "orange", "sand", "mist", "peach", "green"] as const;
export type BannerTone = (typeof BANNER_TONES)[number];
export const BANNER_TONE_LABEL: Record<BannerTone, string> = { navy: "남색", orange: "주황", sand: "모래", mist: "연남색", peach: "연주황", green: "초록" };

export type BannerRow = {
  id: string; kind: BannerKind; title: string; subtitle: string; badge: string; cta: string; href: string; tone: BannerTone;
  imageUrl: string | null; merchantId: string | null; startsOn: string | null; endsOn: string | null; sort: number; active: boolean;
};
/** 화면 카드 — 행에 매장 정보·자동 카드가 합쳐진 것 */
export type BannerCard = { id: string; kind: BannerKind; title: string; subtitle: string; badge: string | null; cta: string; href: string; tone: BannerTone; imageUrl: string | null; period: string | null };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const STORAGE_URL = /^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/[a-z-]+\/[^\s"'<>]{1,200}$/;

/** 어드민이 적은 값 정리 — 제목·링크가 없으면 오류 문구를 돌려준다 */
export function cleanBanner(raw: unknown): { row: Omit<BannerRow, "id">; problem: string | null } {
  const o = (raw ?? {}) as Record<string, unknown>;
  const kind = BANNER_KINDS.includes(o.kind as BannerKind) ? (o.kind as BannerKind) : "event";
  const title = text(o.title, 40), subtitle = text(o.subtitle, 80), badge = text(o.badge, 12), cta = text(o.cta, 12) || "보기";
  let href = text(o.href, 200);
  const tone = BANNER_TONES.includes(o.tone as BannerTone) ? (o.tone as BannerTone) : "navy";
  const img = text(o.imageUrl ?? o.image_url, 300);
  const imageUrl = STORAGE_URL.test(img) ? img : null;
  const merchantId = text(o.merchantId ?? o.merchant_id, 64) || null;
  const d = (v: unknown) => { const s = text(v, 10).replace(/[./]/g, "-"); return DATE.test(s) && !Number.isNaN(Date.parse(s)) ? s : null; };
  const startsOn = d(o.startsOn ?? o.starts_on), endsOn = d(o.endsOn ?? o.ends_on);
  const sort = Math.max(-99, Math.min(99, Math.floor(Number(o.sort ?? 0)) || 0));
  const active = o.active !== false && o.active !== "false" && o.active !== "0";
  if (kind === "partner" && !href) href = "";   // 매장 링크는 카드로 만들 때 채운다
  let problem: string | null = null;
  if (kind !== "partner" && title.length < 2) problem = "제목은 2자 이상";
  else if (kind === "partner" && !merchantId) problem = "파트너 매장을 골라 주세요";
  else if (kind !== "partner" && !/^\/[^\s]*$/.test(href)) problem = "링크는 사이트 안 주소(/로 시작)만";
  else if (startsOn && endsOn && startsOn > endsOn) problem = "기간의 끝이 시작보다 앞입니다";
  return { row: { kind, title, subtitle, badge, cta, href, tone, imageUrl, merchantId, startsOn, endsOn, sort, active }, problem };
}

/** 오늘 보일 카드 — 켜져 있고 기간 안. 순서: sort → 끝이 가까운 이벤트 → id */
export function activeBanners(rows: BannerRow[], today: string): BannerRow[] {
  return rows
    .filter((r) => r.active && (!r.startsOn || r.startsOn <= today) && (!r.endsOn || r.endsOn >= today))
    .sort((a, b) => a.sort - b.sort || (a.endsOn ?? "9999").localeCompare(b.endsOn ?? "9999") || String(a.id).localeCompare(String(b.id)));
}

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const md = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${m}/${d}(${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`; };
/** "9/14(월) ~ 9/27(일)" · 한쪽만 있으면 "~ 9/27(일)까지" · 없으면 null */
export function periodText(startsOn: string | null, endsOn: string | null): string | null {
  if (startsOn && endsOn) return `${md(startsOn)} ~ ${md(endsOn)}`;
  if (endsOn) return `${md(endsOn)}까지`;
  if (startsOn) return `${md(startsOn)}부터`;
  return null;
}

/** 자동 카드 — 이달의 트렌드 리포트 */
export function reportCard(today: string): BannerCard {
  const month = Number(today.slice(5, 7));
  return { id: "report", kind: "report", title: `${month}월 트렌드 리포트`, subtitle: "많이 찾는 술 순위 변동 · 핫한 페어링 · 회원 평가를 한 장으로", badge: "매달 갱신", cta: "리포트 보기", href: "/report", tone: "navy", imageUrl: null, period: null };
}
/** 상시 카드 — 운영 초기에 배너가 비지 않게(어드민 카드가 2장 미만일 때만 덧붙인다) */
export const DEFAULT_CARDS: BannerCard[] = [
  { id: "invite", kind: "custom", title: "나만 아는 페어링을 남겨 주세요", subtitle: "회원 추천은 바로 게시되고, 하트가 모이면 카탈로그 근거가 됩니다", badge: "회원 추천", cta: "추천 남기기", href: "/picks#compose", tone: "peach", imageUrl: null, period: null },
  { id: "partner-join", kind: "custom", title: "양조장·식당 사장님, 파트너가 되어 주세요", subtitle: "메뉴판 사진 한 장으로 술·메뉴 등록, 예약 받기, 입점비 없음", badge: "파트너 모집", cta: "파트너 앱", href: "/places", tone: "mist", imageUrl: null, period: null },
];

export type PartnerForBanner = { id: string; name: string; kind: "restaurant" | "brewery" | "liquor"; kakaoId: string; photo: string | null; intro?: string | null };
const PARTNER_LINE: Record<PartnerForBanner["kind"], { badge: string; cta: string; subtitle: string }> = {
  brewery: { badge: "이달의 파트너 양조장", cta: "방문 시음 예약", subtitle: "양조장에서 빚는 술과 방문 시음" },
  restaurant: { badge: "이달의 파트너 식당", cta: "매장 보기", subtitle: "고른 술과 어울리는 메뉴를 파는 곳" },
  liquor: { badge: "이달의 파트너 리쿼샵", cta: "매장 보기", subtitle: "취급하는 술과 방문 픽업" },
};

/** 행 + 매장 정보 → 화면 카드. partner 행은 매장이 없으면 빠진다. 앞에 리포트 카드, 어드민 카드가 2장 미만이면 상시 카드를 덧붙인다 */
export function bannerCards(rows: BannerRow[], today: string, partners: Record<string, PartnerForBanner>): BannerCard[] {
  const out: BannerCard[] = [reportCard(today)];
  for (const r of activeBanners(rows, today)) {
    if (r.kind === "report") continue;   // 자동 카드가 이미 있다
    if (r.kind === "partner") {
      const p = r.merchantId ? partners[r.merchantId] : null;
      if (!p) continue;
      const line = PARTNER_LINE[p.kind];
      out.push({ id: r.id, kind: "partner", title: r.title || p.name, subtitle: r.subtitle || p.intro || line.subtitle, badge: r.badge || line.badge, cta: r.cta && r.cta !== "보기" ? r.cta : line.cta, href: r.href || `/places/${p.kakaoId}?n=${encodeURIComponent(p.name)}`, tone: r.tone, imageUrl: r.imageUrl || p.photo, period: periodText(r.startsOn, r.endsOn) });
      continue;
    }
    out.push({ id: r.id, kind: r.kind, title: r.title, subtitle: r.subtitle, badge: r.badge || null, cta: r.cta, href: r.href, tone: r.tone, imageUrl: r.imageUrl, period: periodText(r.startsOn, r.endsOn) });
  }
  if (out.length < 3) for (const c of DEFAULT_CARDS) if (out.length < 3) out.push(c);
  return out;
}

/** 홈 위 탭(캐치테이블식 2단 탭) — 홈에서만 보인다 */
export const HOME_TABS: { href: string; label: string }[] = [
  { href: "/", label: "홈" }, { href: "/drinks?kind=trad", label: "전통주" }, { href: "/drinks?kind=whisky", label: "위스키" }, { href: "/drinks?kind=sake", label: "사케" }, { href: "/drinks?kind=wine", label: "와인" },
  { href: "/foods", label: "음식" }, { href: "/awards?c=fair", label: "수상" }, { href: "/hot", label: "핫한 페어링" },
];
/** 서비스 타일 4장(데일리샷식) — 네 가지 흐름 */
export const FLOW_TILES: { href: string; title: string; sub: string; tone: BannerTone; icon: string }[] = [
  { href: "/drinks", title: "술로 찾기", sub: "어울리는 음식", tone: "orange", icon: "🍶" },
  { href: "/foods", title: "음식으로 찾기", sub: "어울리는 술", tone: "navy", icon: "🍢" },
  { href: "/places", title: "식당 예약", sub: "조합을 파는 곳", tone: "green", icon: "📍" },
  { href: "/places?kind=brewery", title: "양조장 방문", sub: "시음 예약", tone: "sand", icon: "🏡" },
];
