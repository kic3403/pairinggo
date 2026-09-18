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
