import Link from "next/link";

/** 상단 막대 — 브랜드 · (로그인했으면) 매장 이름 · 로그아웃 */
export function Bar({ store, signedIn }: { store?: string; signedIn?: boolean }) {
  return (
    <header className="bar">
      <div className="in">
        <Link href="/" className="brand"><span className="dots"><i /><i /></span>페어링GO <small>파트너</small></Link>
        {store ? <span className="store">{store}</span> : null}
        {signedIn ? (
          <form action="/api/logout" method="post" style={store ? undefined : { marginLeft: "auto" }}>
            <button className="linklike" type="submit">로그아웃</button>
          </form>
        ) : null}
      </div>
    </header>
  );
}

const TABS = [
  { key: "home", href: "/", label: "오늘" },
  { key: "reservations", href: "/reservations", label: "예약" },
  { key: "store", href: "/store", label: "매장 정보" },   // 양조장은 "양조장 정보"(infoTabLabel)
  { key: "sell", href: "/sell", label: "판매" },
  { key: "settings", href: "/settings", label: "예약 설정" },
  { key: "pairings", href: "/pairings", label: "페어링" },
  { key: "reviews", href: "/reviews", label: "리뷰" },
] as const;

/** 정보 탭 이름 — 양조장은 "양조장 정보", 식당·리쿼샵은 "매장 정보"(2026-10-02 사용자 요청) */
export const infoTabLabel = (kind?: string) => (kind === "brewery" ? "양조장 정보" : "매장 정보");

/** 아래 탭 — 승인된 매장 화면에서만 */
/**
 * 판매 탭은 모든 업종(2026-10-02) — 식당은 메뉴판, 양조장은 판매하는 술 + 온라인 판매, 리쿼샵은 취급하는 술을 여기서 적는다.
 * 온라인 판매(상품·주문)는 그 안에서 양조장에만 보인다(docs/22). 페어링 탭은 양조장·식당(2026-09-29 식당 추천 페어링 추가)
 */
export function Tabs({ active, kind = "restaurant" }: { active: (typeof TABS)[number]["key"]; kind?: string }) {
  const tabs = TABS.filter((t) => (t.key === "pairings" ? kind === "brewery" || kind === "restaurant" : true));
  return (
    <nav className="tabs" aria-label="파트너 메뉴">
      {tabs.map((t) => <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}>{t.key === "store" ? infoTabLabel(kind) : t.label}</Link>)}
    </nav>
  );
}
