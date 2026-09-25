"use client";
/**
 * 홈 배너 캐러셀(2026-09-25, 캐치테이블·데일리샷식) — 옆으로 넘기는 카드, 다음 카드가 살짝 보이고 "n/N 전체 >". 자동 넘김 없음(움직임 최소).
 * scroll-snap으로 손가락·마우스 스크롤, 키보드 ←→. 사진이 있으면 사진 카드, 없으면 색·큰 글자 카드.
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { BannerCard } from "@pairinggo/shared/home";

export default function HomeBanners({ cards }: { cards: BannerCard[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [cur, setCur] = useState(1);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onScroll = () => { const w = el.firstElementChild?.clientWidth || 1; setCur(Math.min(cards.length, Math.max(1, Math.round(el.scrollLeft / (w + 10)) + 1))); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [cards.length]);
  const go = (d: 1 | -1) => { const el = ref.current; if (!el) return; const w = (el.firstElementChild?.clientWidth || 0) + 10; el.scrollBy({ left: d * w, behavior: "smooth" }); };
  if (!cards.length) return null;
  return (
    <section className="banners" aria-label="소식">
      <ul className="bn-track" ref={ref} onKeyDown={(e) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); }}>
        {cards.map((c) => (
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
      <Link href="/events" className="bn-count" aria-label={`소식 ${cur} / ${cards.length}, 전체 보기`}>{cur} / {cards.length} <b>전체 ›</b></Link>
    </section>
  );
}
