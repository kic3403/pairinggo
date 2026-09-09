import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { D, F, byDrink, SRC_LABEL, naverMapUrl, buyLink, onlineSellable } from "@pairinggo/shared";
import { savedStore, savedKey, toggleSaved, toast, isSaved, useRegion, type SavedItem } from "@/lib/prefs";
import NearbyLink from "@/components/NearbyLink";
import ExtLink from "@/components/ExtLink";

type Tab = "pair" | "drink" | "food" | "place";
const TABS: [Tab, string][] = [["pair", "페어링"], ["drink", "술"], ["food", "음식"], ["place", "식당"]];

export default function Saved() {
  const all = savedStore.use();
  const [tab, setTab] = useState<Tab>("pair");
  const list = all.filter((s) => s.k === tab);
  const remove = (s: SavedItem) => { toggleSaved(s); toast("저장을 해제했어요"); };

  return (
    <main className="px-5 pt-7">
      <h1 className="font-bold text-[24px] tracking-tight">저장</h1>
      <p className="text-[12.5px] text-muted mt-1">마음에 든 페어링 조합, 술, 음식, 식당을 모아둡니다 · 이 기기에만 저장돼요</p>
      <div className="flex border-b border-line mt-4" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`flex-1 py-2.5 text-[13px] font-semibold border-b-2 -mb-px ${tab === k ? "text-ink border-ink" : "text-muted border-transparent"}`}>
            {l}<b className="font-medium text-[11px] text-muted ml-1">{all.filter((s) => s.k === k).length}</b>
          </button>
        ))}
      </div>
      {tab === "place" && <PlaceForm />}
      {!list.length ? (
        <div className="py-10 text-center">
          <div className="text-[17px] font-bold">아직 저장한 항목이 없어요</div>
          <p className="text-[13px] text-muted mt-2">{{ pair: "추천 카드의 ♡를 누르면 술+음식 조합이 여기에 모여요.", drink: "술 이름 옆의 ♡를 누르면 여기에 모여요.", food: "음식 이름 옆의 ♡를 누르면 여기에 모여요.", place: "위 입력창으로 가고 싶은 식당을 저장해요." }[tab]}</p>
        </div>
      ) : (
        <div className="flex flex-col">
          {list.map((s) => <Row key={savedKey(s)} s={s} onRemove={() => remove(s)} />)}
        </div>
      )}
    </main>
  );
}

function Row({ s, onRemove }: { s: SavedItem; onRemove: () => void }) {
  const rm = <button onClick={onRemove} className="w-8 h-8 flex items-center justify-center text-muted rounded-md shrink-0" aria-label="삭제"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>;
  const wrap = (body: ReactNode) => <div className="flex items-center gap-3 py-3.5 border-b border-line">{body}{rm}</div>;
  if (s.k === "pair") {
    const d = D[s.d], f = F[s.f]; if (!d || !f) return null;
    const p = (byDrink[s.d] || []).find((x) => x.f === s.f);
    return wrap(<Link to={`/drink/${s.d}`} className="flex-1 min-w-0"><div className="font-bold text-[15px]">{d.name}<span className="text-food px-1.5 text-xs font-normal">✕</span>{f.name}</div><div className="text-[12px] text-muted mt-0.5 truncate">{p ? `매칭점수 ${p.es} · ${SRC_LABEL[p.src ?? "profile"]} · ${p.reason}` : d.category}</div></Link>);
  }
  if (s.k === "drink") {
    const d = D[s.id]; if (!d) return null;
    return wrap(<Link to={`/drink/${s.id}`} className="flex-1 min-w-0"><div className="font-bold text-[15px]">{d.name}</div><div className="text-[12px] text-muted mt-0.5">{d.category}{d.abv != null ? ` · ${d.abv}%` : ""} · {d.region || d.brewery}{onlineSellable(d) && <> · <ExtLink href={buyLink(d).url} kind="buy" meta={{ drink: d.id }} className="text-drink-ink font-semibold">구매</ExtLink></>}</div></Link>);
  }
  if (s.k === "food") {
    const f = F[s.id]; if (!f) return null;
    return wrap(<Link to={`/food/${s.id}`} className="flex-1 min-w-0"><div className="font-bold text-[15px]">{f.name}</div><div className="text-[12px] text-muted mt-0.5">{f.category} · <NearbyLink name={f.name} suffix="맛집" className="text-drink-ink font-semibold" tail=" 식당 찾기" /></div></Link>);
  }
  return wrap(<div className="flex-1 min-w-0"><div className="font-bold text-[15px]">{s.name}{s.rating != null && <span className="text-food text-[12px] ml-1.5">★ {s.rating.toFixed(1)}</span>}</div><div className="text-[12px] text-muted mt-0.5 truncate">{[s.food, s.region, s.address].filter(Boolean).join(" · ")}{(s.food || s.region || s.address) ? " · " : ""}<ExtLink href={s.url || naverMapUrl(s.name)} kind="map" className="text-drink-ink font-semibold">네이버지도 →</ExtLink></div></div>);
}

function PlaceForm() {
  const [name, setName] = useState(""); const [food, setFood] = useState("");
  const { st, cur } = useRegion();
  const add = () => {
    const n = name.trim(); if (!n) { toast("식당 이름을 입력해 주세요"); return; }
    const item: SavedItem = { k: "place", name: n, food: food.trim(), region: st.gps || cur.id === "all" ? "" : cur.label };
    if (isSaved(savedStore.read(), item)) { toast("이미 저장된 식당이에요"); return; }
    toggleSaved(item); toast("식당을 저장했어요"); setName(""); setFood("");
  };
  return (
    <div className="pt-3">
      <div className="flex gap-1.5">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="식당 이름 (예: 을지로 OO집)" className="flex-1 min-w-0 bg-transparent border-b border-line focus:border-ink outline-none py-1.5 text-[13.5px]" />
        <input value={food} onChange={(e) => setFood(e.target.value)} placeholder="음식 (선택)" className="w-24 bg-transparent border-b border-line focus:border-ink outline-none py-1.5 text-[13.5px]" />
        <button onClick={add} className="text-[12.5px] font-bold px-3 py-1.5 border border-ink rounded-md">저장</button>
      </div>
      <p className="text-[11px] text-muted mt-2 leading-relaxed">가고 싶거나 다녀온 식당을 메모처럼 저장해요.</p>
    </div>
  );
}
