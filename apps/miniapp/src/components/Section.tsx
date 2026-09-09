import type { ReactNode } from "react";
import { Link } from "react-router";

/** 홈·상세 공용 섹션: 라벨 + 우측 더보기 링크 */
export default function Section({ label, more, to, children, className = "" }: { label: string; more?: string; to?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-7 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="sec-label flex-1">{label}</div>
        {more && to && <Link to={to} className="text-[11.5px] font-bold text-ink2 shrink-0">{more} ›</Link>}
      </div>
      {children}
    </section>
  );
}

/** 상세 화면 상단: 뒤로 + 제목 + 우측 액션 */
export function BackHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => (history.length > 1 ? history.back() : location.assign("/"))} className="w-9 h-9 flex items-center justify-center rounded-lg text-xl" aria-label="뒤로">‹</button>
      <div className="flex-1 min-w-0">
        <h1 className="font-serif font-bold text-[19px] truncate">{title}</h1>
        {sub && <div className="text-xs text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  );
}
