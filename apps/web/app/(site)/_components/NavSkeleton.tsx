/**
 * 화면 사이 뼈대 그림(2026-09-30 속도 개선, 2026-10-02 옮김) — 사이트 안 링크를 누른 뒤 다음 화면이 올 때까지 `NavPending`이 띄운다.
 * 전에는 `(site)/loading.tsx`였는데 처음 내려가는 HTML에도 뼈대가 들어가 검색봇이 본문 대신 뼈대를 봤다(NavPending.tsx 설명 참고).
 * 헤더·탭바는 layout에 있어 그대로 남는다. 목록·상세·검색 어느 화면이든 같은 뼈대.
 */
export default function NavSkeleton() {
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
