"use client";
/**
 * 술 정보 편집 폼(어드민, 2026-09-24) — 주종 → 세부 종류 → 국가 → 원어명·별칭 → 주종별 속성(정의 catalog/kinds.ts) → 규격 표(용량·도수·빈티지·병수·메모) → 규격마다 가격 줄(금액·유형·출처·URL·확인일·유효).
 * 기존 가격은 금액을 고칠 수 없고 '유효'만 끌 수 있다(이력). 새 가격은 줄을 더한다. 0원·0mL는 서버가 거부하고 안내한다.
 */
import { useState } from "react";
import { KIND_BY_ID, KIND_LABEL, DRINK_KINDS, type AttrDef } from "@pairinggo/shared/kinds";
import type { DrinkKind } from "@pairinggo/shared/filter-url";
import type { AdminDrink, AdminSpecRow } from "@/lib/admin-drinks";

type PriceDraft = { id?: number; krw?: number | string; type?: string; source?: string; url?: string | null; checked?: string; valid?: boolean; _new?: boolean };
type SpecDraft = { id?: number | null; ml: string; abv: string; vintage: string; pack: "bottle" | "set"; bottles: string; note: string; prices: PriceDraft[] };

const subtypeOf = (kind: DrinkKind, category: string) => {
  for (const s of KIND_BY_ID[kind].subtypes) { if (s.categories.includes(category)) return s.id; const c = s.children?.find((x) => x.categories.includes(category)); if (c) return c.id; }
  return "";
};
const today = () => new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);

function AttrInput({ a, attrs, setAttr }: { a: AttrDef; attrs: Record<string, unknown>; setAttr: (key: string, v: unknown) => void }) {
  const v = attrs[a.key];
  if (a.type === "level") return null;
  if (a.type === "bool") return <label className="row" style={{ gap: 6 }}><input type="checkbox" style={{ width: "auto" }} checked={v === true} onChange={(e) => setAttr(a.key, e.target.checked ? true : (v === true ? null : v))} /> {a.label}{v === false && <span className="muted">(아니요로 기록됨)</span>}<button type="button" className="btn sm" onClick={() => setAttr(a.key, v === false ? null : false)}>{v === false ? "아니요 지우기" : "아니요로"}</button></label>;
  if (a.type === "select") return <label>{a.label}<select value={String(v ?? "")} onChange={(e) => setAttr(a.key, e.target.value)}><option value="">(미확인)</option>{a.options?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>;
  if (a.type === "multi") { const arr = Array.isArray(v) ? (v as string[]) : []; return <div><span className="muted">{a.label}</span><div className="row">{a.options?.map((o) => <label key={o.id} className="row" style={{ gap: 4 }}><input type="checkbox" style={{ width: "auto" }} checked={arr.includes(o.id)} onChange={(e) => setAttr(a.key, e.target.checked ? [...arr, o.id] : arr.filter((x) => x !== o.id))} />{o.label}</label>)}</div></div>; }
  if (a.type === "int") return <label>{a.label}<input type="number" value={v == null ? "" : String(v)} onChange={(e) => setAttr(a.key, e.target.value === "" ? null : Number(e.target.value))} placeholder="미확인이면 비움" /></label>;
  if (a.type === "rating") {
    const r = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
    const set = (k: string, val: unknown) => setAttr(a.key, { ...r, [k]: val });
    return (
      <div>
        <span className="muted">{a.label} — 허용된 출처(라이선스·수입사 제공)만. 자동 수집·약관 금지 출처(Vivino 등)는 넣지 않습니다. 출처·점수·척도·확인일이 다 있어야 저장됩니다</span>
        <div className="row">
          <label style={{ width: 160 }}>출처<input value={String(r.source ?? "")} onChange={(e) => set("source", e.target.value)} /></label>
          <label style={{ width: 80 }}>점수<input type="number" step="0.1" value={String(r.score ?? "")} onChange={(e) => set("score", e.target.value)} /></label>
          <label style={{ width: 70 }}>척도<input type="number" value={String(r.scale ?? 5)} onChange={(e) => set("scale", e.target.value)} /></label>
          <label style={{ width: 90 }}>평가 수<input type="number" value={String(r.count ?? "")} onChange={(e) => set("count", e.target.value)} /></label>
          <label style={{ width: 130 }}>확인일<input type="date" value={String(r.checked ?? "")} onChange={(e) => set("checked", e.target.value)} /></label>
          <label style={{ flex: 1, minWidth: 160 }}>URL<input value={String(r.url ?? "")} onChange={(e) => set("url", e.target.value)} /></label>
        </div>
      </div>
    );
  }
  if (a.type === "tags") return <label>{a.label} <span className="muted">쉼표로 구분{a.options ? ` (품종 id: ${a.options.map((o) => o.id).slice(0, 6).join(", ")}…)` : ""}</span><input value={Array.isArray(v) ? (v as string[]).join(", ") : ""} onChange={(e) => setAttr(a.key, e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>;
  return <label>{a.label}<input value={String(v ?? "")} onChange={(e) => setAttr(a.key, e.target.value)} /></label>;
}

export default function DrinkEditor({ drink }: { drink: AdminDrink }) {
  const [kind, setKind] = useState<DrinkKind>(drink.kind);
  const [subtype, setSubtype] = useState(subtypeOf(drink.kind, drink.category));
  const [country, setCountry] = useState(drink.country);
  const [nameOrig, setNameOrig] = useState(drink.nameOrig);
  const [imageUrl, setImageUrl] = useState(drink.imageUrl);
  const [imageCredit, setImageCredit] = useState(drink.imageCredit);
  const [aliases, setAliases] = useState(drink.aliases.join(", "));
  const [attrs, setAttrs] = useState<Record<string, unknown>>(drink.attrs);
  const [specs, setSpecs] = useState<SpecDraft[]>(drink.specs.map((s: AdminSpecRow) => ({ id: s.id, ml: s.ml == null ? "" : String(s.ml), abv: s.abv == null ? "" : String(s.abv), vintage: s.vintage ?? "", pack: s.pack, bottles: String(s.bottles), note: s.note ?? "", prices: s.prices.map((p) => ({ ...p })) })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const def = KIND_BY_ID[kind];
  const subtypeOptions = def.subtypes.flatMap((s) => [{ id: s.id, label: s.label }, ...(s.children ?? []).map((c) => ({ id: c.id, label: `${s.label} › ${c.label}` }))]);
  const changeKind = (k: DrinkKind) => { setKind(k); setSubtype(""); setCountry(KIND_BY_ID[k].countries[0].id); setAttrs({}); };
  const setAttr = (key: string, v: unknown) => setAttrs((a) => { const n = { ...a }; if (v == null || v === "" || (Array.isArray(v) && !v.length)) delete n[key]; else n[key] = v; return n; });
  const setSpec = (i: number, patch: Partial<SpecDraft>) => setSpecs((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const setPrice = (i: number, j: number, patch: PriceDraft) => setSpecs((ss) => ss.map((s, k) => (k === i ? { ...s, prices: s.prices.map((p, l) => (l === j ? { ...p, ...patch } : p)) } : s)));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/admin/api/drinks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: drink.id, kind, subtype, category: drink.category, country, nameOrig, aliases, attrs, specs, imageUrl, imageCredit }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "저장 실패");
      setMsg(`저장·발행 완료 (버전 ${String(j.version).slice(0, 19)})${j.problems?.length ? `\n주의: ${j.problems.join(" / ")}` : ""}`);
      setTimeout(() => location.reload(), 900);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="card" style={{ display: "grid", gap: 8 }}>
        <b>분류</b>
        <div className="row">
          {DRINK_KINDS.map((k) => <label key={k.id} className="row" style={{ gap: 4 }}><input type="radio" name="kind" style={{ width: "auto" }} checked={kind === k.id} onChange={() => changeKind(k.id)} />{k.label}</label>)}
        </div>
        <label>세부 종류{kind === "trad" ? "(종류)" : ""}<select value={subtype} onChange={(e) => setSubtype(e.target.value)}><option value="">(미확인)</option>{subtypeOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
        {kind === "sake" && <p className="muted">특정명칭을 모르면 미확인으로 두세요 — 후쓰슈로 임의 분류하지 않습니다. 정미율만으로 판정하지 않습니다.</p>}
        {kind === "wine" && <p className="muted">색상만 고릅니다. 스파클링·주정강화·디저트·내추럴은 아래 속성에서.</p>}
        {kind === "whisky" && <p className="muted">아이리시·재패니즈는 종류가 아니라 국가입니다. 버번은 미국 위스키 전체가 아닙니다.</p>}
        <label>국가·생산지<select value={country} onChange={(e) => setCountry(e.target.value)}>{def.countries.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
        <label>원어명<input value={nameOrig} onChange={(e) => setNameOrig(e.target.value)} placeholder="라벨 표기 (예: Glen Demo 12 Years)" /></label>
        <label>추가 별칭 <span className="muted">쉼표 구분 · 첫 별칭 “{drink.alias0}”은 유지</span><input value={aliases} onChange={(e) => setAliases(e.target.value)} placeholder="영문명, 줄임말, 흔한 표기" /></label>
        {/* 공식 사진(0009) — 사용 허락을 받은 사진만. 비우면 파트너 매장 사진 폴백 → 없으면 주종 색 타일 */}
        <div className="row" style={{ alignItems: "flex-start", gap: 10 }}>
          {imageUrl && <img src={imageUrl} alt="" style={{ width: 56, height: 74, objectFit: "contain", border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }} />}
          <label style={{ flex: 1, minWidth: 220 }}>사진 주소 <span className="muted">https://… 또는 /… · 사용 허락을 받은 사진만(더술닷컴 사진 금지)</span><input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="비우면 파트너 매장 사진 → 주종 색 타일" /></label>
          <label style={{ width: 200 }}>사진 출처<input value={imageCredit} onChange={(e) => setImageCredit(e.target.value)} placeholder="예: 양조장 제공" /></label>
        </div>
      </div>

      {def.attrs.some((a) => a.type !== "level") && (
        <div className="card" style={{ display: "grid", gap: 8 }}>
          <b>{KIND_LABEL[kind]} 속성 <span className="muted">확인된 것만 — 모르면 비움</span></b>
          {def.attrs.filter((a) => a.type !== "level").map((a) => <AttrInput key={a.key} a={a} attrs={attrs} setAttr={setAttr} />)}
        </div>
      )}

      <div className="card" style={{ display: "grid", gap: 10 }}>
        <b>판매 규격과 참고가격 <span className="muted">한 병 기준 · 배송비·쿠폰 제외 · 세트는 병수 2 이상</span></b>
        {specs.map((s, i) => (
          <div key={s.id ?? `n${i}`} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
            <div className="row">
              <label style={{ width: 120 }}>용량(mL)<input value={s.ml} onChange={(e) => setSpec(i, { ml: e.target.value })} placeholder="720 · 1.8L" /></label>
              <label style={{ width: 90 }}>도수<input value={s.abv} onChange={(e) => setSpec(i, { abv: e.target.value })} /></label>
              <label style={{ width: 100 }}>빈티지<input value={s.vintage} onChange={(e) => setSpec(i, { vintage: e.target.value })} placeholder="NV면 비움" /></label>
              <label style={{ width: 100 }}>구성<select value={s.pack} onChange={(e) => setSpec(i, { pack: e.target.value as "bottle" | "set", bottles: e.target.value === "set" ? (Number(s.bottles) >= 2 ? s.bottles : "2") : "1" })}><option value="bottle">한 병</option><option value="set">세트</option></select></label>
              {s.pack === "set" && <label style={{ width: 80 }}>병수<input type="number" min={2} value={s.bottles} onChange={(e) => setSpec(i, { bottles: e.target.value })} /></label>}
              <label style={{ flex: 1, minWidth: 160 }}>메모<input value={s.note} onChange={(e) => setSpec(i, { note: e.target.value })} /></label>
              <button type="button" className="btn sm d" onClick={() => setSpecs((ss) => ss.filter((_, j) => j !== i))}>규격 삭제</button>
            </div>
            <table className="t">
              <thead><tr><th>금액(원)</th><th>유형</th><th>출처</th><th>출처 URL</th><th>확인일</th><th>유효</th><th></th></tr></thead>
              <tbody>
                {s.prices.map((p, j) => (
                  <tr key={p.id ?? `p${j}`}>
                    <td style={{ width: 110 }}>{p.id ? Number(p.krw).toLocaleString("ko-KR") : <input value={String(p.krw ?? "")} onChange={(e) => setPrice(i, j, { krw: e.target.value })} placeholder="38000" />}</td>
                    <td style={{ width: 120 }}>{p.id ? (p.type === "msrp" ? "권장소비자가" : "판매처 가격") : <select value={p.type ?? "retail"} onChange={(e) => setPrice(i, j, { type: e.target.value })}><option value="retail">판매처 가격</option><option value="msrp">권장소비자가</option></select>}</td>
                    <td>{p.id ? p.source : <input value={p.source ?? ""} onChange={(e) => setPrice(i, j, { source: e.target.value })} placeholder="판매처·수입사" />}</td>
                    <td>{p.id ? (p.url ? <a href={p.url} target="_blank" rel="noreferrer">링크</a> : "") : <input value={p.url ?? ""} onChange={(e) => setPrice(i, j, { url: e.target.value })} placeholder="https://" />}</td>
                    <td style={{ width: 130 }}>{p.id ? p.checked : <input type="date" value={p.checked ?? ""} onChange={(e) => setPrice(i, j, { checked: e.target.value })} />}</td>
                    <td style={{ width: 50 }}>{p.id ? <input type="checkbox" style={{ width: "auto" }} checked={p.valid !== false} onChange={(e) => setPrice(i, j, { valid: e.target.checked })} /> : <span className="muted">새 줄</span>}</td>
                    <td style={{ width: 60 }}>{!p.id && <button type="button" className="btn sm" onClick={() => setSpec(i, { prices: s.prices.filter((_, l) => l !== j) })}>지움</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div><button type="button" className="btn sm" onClick={() => setSpec(i, { prices: [...s.prices, { _new: true, krw: "", type: "retail", source: "", url: "", checked: today() }] })}>+ 가격 추가</button></div>
          </div>
        ))}
        <div><button type="button" className="btn sm" onClick={() => setSpecs((ss) => [...ss, { ml: "", abv: drink.abv == null ? "" : String(drink.abv), vintage: "", pack: "bottle", bottles: "1", note: "", prices: [] }])}>+ 규격 추가</button></div>
      </div>

      <div className="row">
        <button type="button" className="btn p" onClick={save} disabled={busy}>{busy ? "저장 중…" : "저장하고 발행"}</button>
        {msg && <span className="muted" style={{ whiteSpace: "pre-line" }}>{msg}</span>}
      </div>
    </div>
  );
}
