/**
 * 파트너(양조장·리쿼샵·식당)가 매장 술 표에 올린 사진을 카탈로그 술의 사진으로 쓴다(2026-09-25 사용자 요청).
 *  · 카탈로그 술에 사진이 없을 때만(허락받은 공식 사진이 우선).
 *  · 이름(별칭 포함, 띄어쓰기·기호 무시)이 같은 술 줄의 사진만. 같은 이름이 여러 매장에 있으면 **그 술을 빚은 양조장 파트너**(merchants.brewery = drinks.brewery) 것을 먼저, 없으면 먼저 저장된 곳.
 *  · 출처는 "매장 이름 제공"으로 표시한다. 사진 주소는 우리 저장소(menu-photos) 공개 주소만 들어온다(cleanMenuImage).
 */
export type PartnerPlaceItems = { name: string; brewery?: string | null; items: { name: string; img?: string }[] };
export type PartnerImage = { url: string; credit: string };
const key = (s: string) => (s || "").toLowerCase().replace(/[\s·,.\-()'"‘’·]/g, "");

export function partnerImages(
  drinks: { id: string; name: string; alias?: string[] | string | null; brewery?: string | null }[],
  places: PartnerPlaceItems[],
): Map<string, PartnerImage> {
  const byName = new Map<string, { id: string; brewery: string }[]>();
  for (const d of drinks) {
    const names = [d.name, ...(Array.isArray(d.alias) ? d.alias : d.alias ? [d.alias] : [])];
    for (const n of names) { const k = key(n); if (!k) continue; const arr = byName.get(k) || []; if (!arr.some((x) => x.id === d.id)) arr.push({ id: d.id, brewery: key(d.brewery || "") }); byName.set(k, arr); }
  }
  const out = new Map<string, PartnerImage & { own: boolean }>();
  for (const p of places) {
    const pb = key(p.brewery || "");
    for (const it of p.items) {
      if (!it.img) continue;
      for (const d of byName.get(key(it.name)) || []) {
        const own = !!pb && pb === d.brewery;
        const cur = out.get(d.id);
        if (cur && (cur.own || !own)) continue;   // 양조장 자기 술 사진이 있으면 그대로, 없으면 먼저 온 것
        out.set(d.id, { url: it.img, credit: `${p.name} 제공`, own });
      }
    }
  }
  return new Map([...out].map(([id, v]) => [id, { url: v.url, credit: v.credit }]));
}
