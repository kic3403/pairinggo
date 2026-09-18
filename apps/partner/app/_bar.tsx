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
  { key: "store", href: "/store", label: "매장 정보" },
  { key: "settings", href: "/settings", label: "예약 설정" },
] as const;

/** 아래 탭 — 승인된 매장 화면에서만 */
export function Tabs({ active }: { active: (typeof TABS)[number]["key"] }) {
  return (
    <nav className="tabs" aria-label="파트너 메뉴">
      {TABS.map((t) => <Link key={t.key} href={t.href} aria-current={t.key === active ? "page" : undefined}>{t.label}</Link>)}
    </nav>
  );
}
