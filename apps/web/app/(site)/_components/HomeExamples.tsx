/**
 * 홈 첫 줄 아래 "이렇게 찾아보세요" 예시(2026-10-01) — 처음 온 사람이 무엇을 치면 되는지 3초 안에 알게.
 * 술 이름 · 음식 이름 · 상황 · 지역 네 가지 유형을 하나씩. 누르면 그대로 검색.
 */
import Link from "next/link";

const EXAMPLES: { q: string; label: string }[] = [
  { q: "육회에 어울리는 술", label: "육회에 어울리는 술" },
  { q: "한산소곡주", label: "한산소곡주" },
  { q: "매운 안주", label: "매운 안주" },
  { q: "대전 전통주", label: "대전 전통주" },
];

export default function HomeExamples() {
  return (
    <p className="home-ex" aria-label="검색 예시">
      <span className="muted">이렇게 찾아보세요</span>
      {EXAMPLES.map((e) => <Link key={e.q} href={`/search?q=${encodeURIComponent(e.q)}`}>{e.label}</Link>)}
    </p>
  );
}
