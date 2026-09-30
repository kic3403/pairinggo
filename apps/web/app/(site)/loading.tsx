/**
 * 화면 사이 로딩 뼈대(2026-09-30 속도 개선) — 앱 라우터가 다음 화면을 서버에서 만드는 동안 이전 화면에 멈춰 있지 않고
 * 곧바로 이 뼈대로 바뀐다. 헤더·탭바는 layout에 있어 그대로 남는다. 목록·상세·검색 어느 화면이든 같은 뼈대.
 */
export default function Loading() {
  return (
    <div className="wrap skel" aria-busy="true" aria-live="polite" aria-label="불러오는 중">
      <div className="sk sk-crumb" />
      <div className="sk sk-h1" />
      <div className="sk-row">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-chip" />)}</div>
      <div className="sk-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="sk-card">
            <div className="sk sk-tile" />
            <div className="sk-lines"><div className="sk sk-line w60" /><div className="sk sk-line w40" /><div className="sk sk-line w80" /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
