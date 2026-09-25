/** 소식 전체(2026-09-25) — 홈 배너 "n/N 전체 ›"가 오는 곳. 지금 보이는 카드와 곧 시작할 이벤트 */
import type { Metadata } from "next";
import Link from "next/link";
import { periodText } from "@pairinggo/shared";
import { allEventCards } from "@/lib/banners";

export const revalidate = 300;
export const metadata: Metadata = { title: "소식·이벤트 | 페어링GO", description: "이달의 트렌드 리포트, 파트너 양조장·매장 소개, 시즌 이벤트", alternates: { canonical: "/events" } };

export default async function EventsPage() {
  const { now, upcoming } = await allEventCards();
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>소식·이벤트</h1>
      <p className="lead">이달의 트렌드 리포트와 파트너 양조장·매장 소개, 시즌 이벤트를 모았습니다.</p>
      <ul className="bn-list">
        {now.map((c) => (
          <li key={c.id}>
            <Link href={c.href} className={`bn tone-${c.tone}${c.imageUrl ? " has-img" : ""}`}>
              {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" />}
              <span className="bn-body">
                {c.badge && <span className="bn-badge">{c.badge}</span>}
                <b className="bn-title">{c.title}</b>
                {c.subtitle && <span className="bn-sub">{c.subtitle}</span>}
                <span className="bn-foot">{c.period && <span className="bn-period">{c.period}</span>}<span className="bn-cta">{c.cta} →</span></span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {upcoming.length > 0 && (
        <section>
          <h2>곧 시작</h2>
          <ul className="rows">
            {upcoming.map((r) => <li key={r.id} className="row"><span className="badge n">{periodText(r.startsOn, r.endsOn)}</span><span className="grow"><b>{r.title}</b><span className="small muted">{r.subtitle}</span></span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
