/**
 * 홈 "안주로 고르기" — 캐치테이블 "음식종류별 BEST"처럼 동그란 사진 줄(2026-10-03 UI 리뉴얼). 사진이 있으면 사진, 없으면 분류 색 타일.
 * 글자는 음식 이름뿐. 가로 스크롤, 끝에 '전체' 동그라미.
 */
import Link from "next/link";
import { toSlug, type Food } from "@pairinggo/shared";

/** 분류별 타일 색(사진이 없을 때) — 전·고기·해산물·치킨·국물·그 밖 */
const TONE: Record<string, string> = {
  전: "radial-gradient(circle at 35% 30%, #F6D3A8, #C9803E 70%, #8E4F1E)", 한식: "radial-gradient(circle at 35% 30%, #E7E2D3, #9C8E6E 70%, #5A4D33)",
  구이: "radial-gradient(circle at 35% 30%, #F2A9A0, #B8323C 70%, #6E1A21)", 회: "radial-gradient(circle at 35% 30%, #D8ECF5, #6FA3C4 70%, #2F5C7A)", 해산물: "radial-gradient(circle at 35% 30%, #D8ECF5, #6FA3C4 70%, #2F5C7A)",
  치킨: "radial-gradient(circle at 35% 30%, #F9E2B0, #D59B3A 70%, #8A5A12)", 튀김: "radial-gradient(circle at 35% 30%, #F9E2B0, #D59B3A 70%, #8A5A12)", 면: "radial-gradient(circle at 35% 30%, #EDE6D6, #B9A98A 70%, #6E5F44)",
};
const DEFAULT = "radial-gradient(circle at 35% 30%, #E9E4DA, #A79C88 70%, #5E5345)";

export default function FoodCircles({ foods, title = "안주로 고르기", href = "/foods" }: { foods: Food[]; title?: string; href?: string }) {
  if (!foods.length) return null;
  return (
    <section className="fcirc">
      <div className="section-head"><h2>{title}</h2><Link href={href}>전체보기 ›</Link></div>
      <ul>
        {foods.map((f) => (
          <li key={f.id}>
            <Link href={`/foods/${toSlug(f.name)}`}>
              <span className="fc-img" style={f.image?.url ? undefined : { background: TONE[f.category] ?? DEFAULT }}>
                {f.image?.url && <img src={f.image.url} alt="" loading="lazy" decoding="async" />}
              </span>
              <span className="fc-name">{f.name}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href={href}>
            <span className="fc-img fc-more"><span>전체</span></span>
            <span className="fc-name muted">더 보기</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
