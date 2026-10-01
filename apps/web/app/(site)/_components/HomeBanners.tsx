"use client";
/**
 * 홈 배너 캐러셀(2026-09-25, 캐치테이블·데일리샷식) — 옆으로 넘기는 카드, 다음 카드가 살짝 보이고 "n/N 전체 >".
 * scroll-snap으로 손가락·마우스 스크롤, 키보드 ←→. 사진이 있으면 사진 카드, 없으면 색·큰 글자 카드.
 * 2026-10-02 사용자 요청: **자동으로 옆으로 넘어가고**(5초마다, 끝에서 처음으로) **양쪽 ‹ › 버튼**으로 지나간 카드도 다시 본다.
 * 자동 넘김은 마우스를 올리거나 손을 대거나 초점이 들어와 있으면 멈추고, 탭이 가려져 있거나 '움직임 줄이기' 설정이면 돌지 않는다. ⏸ 버튼으로 끌 수 있다.
 */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BannerCard } from "@pairinggo/shared/home";

const GAP = 10, EVERY_MS = 5000;

export default function HomeBanners({ cards }: { cards: BannerCard[] }) {
  const ref = useRef<HTMLUListElement>(null);
  const [cur, setCur] = useState(1);
  const [playing, setPlaying] = useState(true);
  /** 넘길 수 있는지 — 카드가 한 화면에 다 들어오면 버튼·자동 넘김이 필요 없다 */
  const [scrollable, setScrollable] = useState(false);
  const hold = useRef(false);   // 마우스·손가락·초점이 올라와 있는 동안

  const step = () => (ref.current?.firstElementChild?.clientWidth || 0) + GAP;
  const go = useCallback((d: 1 | -1) => {
    const el = ref.current; if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 끝에서 다음 → 처음, 처음에서 이전 → 끝
    if (d === 1 && el.scrollLeft >= max - 4) el.scrollTo({ left: 0, behavior: "smooth" });
    else if (d === -1 && el.scrollLeft <= 4) el.scrollTo({ left: max, behavior: "smooth" });
    else el.scrollBy({ left: d * step(), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    const measure = () => setScrollable(el.scrollWidth - el.clientWidth > 4);
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      // 넓은 화면은 마지막 카드까지 한 칸씩 못 간다 — 끝에 닿으면 마지막 번호로
      setCur(el.scrollLeft >= max - 4 && max > 4 ? cards.length : Math.min(cards.length, Math.max(1, Math.round(el.scrollLeft / (step() || 1)) + 1)));
    };
    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", measure); };
  }, [cards.length]);

  useEffect(() => {
    if (!playing || !scrollable) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!hold.current && !document.hidden) go(1); }, EVERY_MS);
    return () => clearInterval(t);
  }, [playing, scrollable, go]);

  if (!cards.length) return null;
  const holdOn = () => { hold.current = true; }, holdOff = () => { hold.current = false; };
  return (
    <section className="banners" aria-label="소식" aria-roledescription="carousel"
      onMouseEnter={holdOn} onMouseLeave={holdOff} onFocus={(e) => { if ((e.target as HTMLElement).matches?.(":focus-visible")) holdOn(); }} onBlur={holdOff} onTouchStart={holdOn} onTouchEnd={() => setTimeout(holdOff, 3000)}>
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
      {scrollable && (
        <>
          <button type="button" className="bn-nav prev" onClick={() => go(-1)} aria-label="이전 소식">‹</button>
          <button type="button" className="bn-nav next" onClick={() => go(1)} aria-label="다음 소식">›</button>
        </>
      )}
      <span className="bn-count">
        {scrollable && <button type="button" className="bn-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "자동 넘김 멈추기" : "자동 넘김 켜기"} aria-pressed={!playing}>{playing ? "❚❚" : "▶"}</button>}
        <Link href="/events" aria-label={`소식 ${cur} / ${cards.length}, 전체 보기`}>{cur} / {cards.length} <b>전체 ›</b></Link>
      </span>
    </section>
  );
}
