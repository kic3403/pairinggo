/**
 * 상세 머리 카드(.dhead) 오른쪽 사진 칸(2026-09-26 사용자 요청 — 검색해 들어온 술·음식의 사진이 머리 카드 오른쪽에).
 * 사진이 있으면 사진(술은 병이 잘리지 않게 contain, 음식은 cover) + 출처, 없으면 같은 크기의 자리표시 타일
 * (주종·분류 색 + 병/그릇 실루엣 + 종류 이름 + "사진 준비 중") — 사진 유무와 무관하게 카드 모양이 같다.
 * 술 사진은 공식 사진 → 파트너 매장 사진 폴백(shared partnerImages)까지 lib/catalog.ts가 붙여 준다.
 */
export const KIND_TONE: Record<string, string> = { trad: "#22406B", whisky: "#8A5A00", sake: "#3D6E9B", wine: "#7B2D4B", food: "#1F3A5F" };

type Img = { url: string; credit?: string | null } | null | undefined;

export default function DetailMedia({ kind, image, name, label, tone }: { kind: "drink" | "food"; image?: Img; name: string; label: string; tone?: string }) {
  const k = kind === "drink" ? "d" : "f";
  if (image?.url) {
    return (
      <figure className={`dhead-media ${k}`}>
        <img src={image.url} alt={`${name} 사진`} />
        {image.credit && <figcaption className="small muted" title={image.credit}>{image.credit}</figcaption>}
      </figure>
    );
  }
  return (
    <div className={`dhead-media ph ${k}`} style={{ ["--tone" as string]: tone ?? KIND_TONE[kind === "food" ? "food" : "trad"] }} role="img" aria-label={`${name} 사진 준비 중`}>
      {kind === "drink"
        ? <svg viewBox="0 0 24 40" aria-hidden="true"><path d="M9 1h6v3l-1 1v5c0 1.5 3 2.5 3 5v21a3 3 0 0 1-3 3h-4a3 3 0 0 1-3-3V15c0-2.5 3-3.5 3-5V5L9 4z" fill="currentColor" opacity=".9" /><rect x="8" y="22" width="8" height="8" rx="1" fill="#fff" opacity=".35" /></svg>
        : <svg viewBox="0 0 40 30" aria-hidden="true"><path d="M2 12h36c0 8-6 14-14 15v1h-8v-1C8 26 2 20 2 12z" fill="currentColor" opacity=".9" /><path d="M12 8c0-3 3-3 3-6M20 8c0-3 3-3 3-6M28 8c0-3 3-3 3-6" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" /></svg>}
      <b>{label}</b>
      <span>사진 준비 중</span>
    </div>
  );
}
