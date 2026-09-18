"use client";
/**
 * 식당 검색(2026-09-19 사용자 요청) — 식당 이름·키워드로 찾는다. 카카오 로컬은 검색할 때만 부른다(유료 쿼터).
 * 어디서: 관심지역 주변(기본, 있으면) · 지금 내 위치 주변 · 전국. 결과 카드는 맛집 목록과 같다(PlaceList).
 */
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PlaceList, { type PlaceView } from "./PlaceList";
import { useHydrated, useRegion } from "./RegionProvider";
import { track } from "@/lib/track";

type Res = { places: PlaceView[]; source: string; awardsYear?: number | null; error?: string; widened?: boolean };
type Where = "region" | "gps" | "all";

export default function PlaceSearch({ initialQuery }: { initialQuery: string }) {
  const rg0 = useRegion();
  const hydrated = useHydrated();
  const rg = hydrated ? rg0 : { ...rg0, region: null, label: "전국", gps: null };
  const router = useRouter(), pathname = usePathname();
  const [q, setQ] = useState(initialQuery);
  const [where, setWhere] = useState<Where>("all");
  const [state, setState] = useState<"idle" | "loading" | "done" | "denied">("idle");
  const [res, setRes] = useState<Res | null>(null);
  const [label, setLabel] = useState("");
  const ran = useRef(false);

  // 관심지역이 있으면 그 주변이 기본
  useEffect(() => { if (hydrated && rg0.region) setWhere("region"); }, [hydrated, rg0.region]);

  async function run(query: string, w: Where) {
    const text = query.replace(/\s+/g, " ").trim();
    if (text.length < 2) { setRes({ places: [], source: "none", error: "두 글자 이상 적어 주세요" }); setState("done"); return; }
    const p = new URLSearchParams({ q: text });
    let lbl = "전국";
    if (w === "region" && rg.region) {
      if (rg.gps) { p.set("lat", String(rg.gps.lat)); p.set("lng", String(rg.gps.lng)); } else p.set("region", rg.id);
      lbl = `${rg.label} 주변`;
    }
    if (w === "gps") {
      const pos = await new Promise<GeolocationPosition | null>((ok) => {
        if (!navigator.geolocation) return ok(null);
        navigator.geolocation.getCurrentPosition(ok, () => ok(null), { timeout: 8000, maximumAge: 300_000 });
      });
      if (!pos) { setState("denied"); return; }
      p.set("lat", String(pos.coords.latitude)); p.set("lng", String(pos.coords.longitude));
      lbl = "내 주변";
    }
    setState("loading"); setLabel(lbl);
    router.replace(`${pathname}?q=${encodeURIComponent(text)}`, { scroll: false });
    let out: Res;
    try {
      const r = await fetch(`/api/v1/places/search?${p}`);
      out = r.ok ? await r.json() : { places: [], source: "none", error: (await r.json().catch(() => ({})))?.error ?? "검색하지 못했어요" };
    } catch { out = { places: [], source: "none", error: "검색하지 못했어요" }; }
    setRes(out); setState("done");
    track("restaurant_list", { mode: "search", n: out.places.length, source: out.source, basis: w });
  }

  // 링크로 들어온 검색어(?q=)는 한 번 바로 찾는다 — 관심지역을 읽은 뒤에
  useEffect(() => {
    if (ran.current || !hydrated || !initialQuery) return;
    ran.current = true;
    void run(initialQuery, rg0.region ? "region" : "all");
  }, [hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const opts: { id: Where; text: string }[] = [
    ...(rg.region ? [{ id: "region" as const, text: `📍 ${rg.label} 주변` }] : []),
    { id: "gps", text: "내 주변" },
    { id: "all", text: "전국" },
  ];

  return (
    <section className="psearch">
      <form className="psearch-form" role="search" onSubmit={(e) => { e.preventDefault(); void run(q, where); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="식당 이름이나 동네 + 메뉴 (예: 성심당, 을지로 노포)" aria-label="식당 검색" maxLength={40} enterKeyHint="search" />
        <button type="submit" className="btn p" disabled={state === "loading"}>찾기</button>
      </form>
      <div className="psearch-where" role="group" aria-label="어디에서 찾을까요">
        {opts.map((o) => (
          <button key={o.id} type="button" aria-pressed={where === o.id} onClick={() => { setWhere(o.id); if (q.trim().length >= 2 && state !== "idle") void run(q, o.id); }}>{o.text}</button>
        ))}
        {!rg.region ? <button type="button" className="linklike" onClick={rg.open}>관심지역 정하기</button> : null}
      </div>
      {state === "loading" ? <p className="muted">{label}에서 찾는 중…</p> : null}
      {state === "denied" ? <p className="muted">위치를 쓸 수 없어요. 관심지역이나 전국으로 찾아 주세요.</p> : null}
      {state === "done" && res ? (
        res.error ? <p className="form-error">{res.error}</p>
          : res.places.length ? <>
            {res.widened ? <p className="small muted" style={{ margin: "0 0 8px" }}>{label}에 ‘{q.trim()}’ 이름의 식당이 없어, 전국에서 찾은 곳을 앞에 함께 보여 드려요.</p> : null}
            <PlaceList places={res.places} where={res.widened ? `${label} + 전국` : label} awardsYear={res.awardsYear ?? null} restaurants eventKey={{}} savedAs={q.trim()} limit={30} />
          </>
          : <p className="muted">{res.source === "none" ? "식당 검색을 쓸 수 없어요." : `${label}에서 찾은 식당이 없어요. 이름을 조금 다르게 적거나 전국으로 찾아보세요.`}</p>
      ) : null}
    </section>
  );
}
