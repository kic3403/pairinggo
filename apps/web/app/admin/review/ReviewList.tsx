"use client";
import { useEffect, useRef, useState } from "react";
import type { CandidateRow } from "@/lib/admin-data";
import type { Pairing } from "@pairinggo/shared";

export type Card = CandidateRow & { drinkName: string; foodName: string; existing: Pairing | null; siblings: number; sameUrl: boolean; gap: "both" | "drink" | "food" | null };
const TIERS = ["official", "sommelier", "media", "blog", "user"];
const TIER_DEFAULT: Record<string, number> = { official: 96, sommelier: 93, media: 89, blog: 85, user: 85 };
const REJECT_REASONS = ["관련 없음(이름만 등장)", "광고·협찬 글", "근거 부족", "중복", "음식·술 매칭 오류", "기타"];

async function post(path: string, body: unknown) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ReviewList({ cards: initial }: { cards: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [i, setI] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [reviewer, setReviewer] = useState("");
  const busy = useRef(false);
  useEffect(() => { try { setReviewer(localStorage.getItem("pgo_reviewer") || ""); } catch { /* noop */ } }, []);
  useEffect(() => { try { localStorage.setItem("pgo_reviewer", reviewer); } catch { /* noop */ } }, [reviewer]);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  const remove = (id: number) => setCards((cs) => cs.filter((c) => c.id !== id));

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA" || (e.target as HTMLElement)?.tagName === "SELECT") return;
      if (e.key === "ArrowDown" || e.key === "j") setI((x) => Math.min(cards.length - 1, x + 1));
      if (e.key === "ArrowUp" || e.key === "k") setI((x) => Math.max(0, x - 1));
      if (e.key === "s" || e.key === "S") setI((x) => Math.min(cards.length - 1, x + 1));
      if (e.key === "a" || e.key === "A") document.getElementById(`approve-${cards[i]?.id}`)?.click();
      if (e.key === "r" || e.key === "R") document.getElementById(`reject-${cards[i]?.id}`)?.click();
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [cards, i]);
  useEffect(() => { document.getElementById(`card-${cards[i]?.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [i, cards]);

  if (!cards.length) return <div className="card"><b>검수할 후보가 없어요.</b><p className="muted">엑셀 가져오기(pnpm db:import)나 자동 수집(pnpm db:collect)으로 후보를 채우세요.</p></div>;

  return (
    <>
      <div className="card row" style={{ position: "sticky", top: 0, zIndex: 5 }}>
        <label style={{ margin: 0 }}>검수자</label>
        <input value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="이름 (승인 근거의 추천자에도 씀)" style={{ maxWidth: 220 }} />
        <span className="muted">{i + 1} / {cards.length}</span>
      </div>
      {cards.map((c, idx) => <CardView key={c.id} c={c} selected={idx === i} onFocus={() => setI(idx)} reviewer={reviewer} busy={busy} say={say} remove={remove} />)}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function CardView({ c, selected, onFocus, reviewer, busy, say, remove }: { c: Card; selected: boolean; onFocus: () => void; reviewer: string; busy: React.MutableRefObject<boolean>; say: (m: string) => void; remove: (id: number) => void }) {
  const [tier, setTier] = useState(c.suggested_tier && TIERS.includes(c.suggested_tier) ? c.suggested_tier : "blog");
  const [score, setScore] = useState<number>(c.suggested_score || TIER_DEFAULT[tier]);
  const [who, setWho] = useState(c.who || "");
  const [reason, setReason] = useState(c.suggested_reason || "");
  const [rejectOpen, setRejectOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(c.status === "needs_entity");
  const needsEntity = !c.drink_id || !c.food_id;

  const approve = async () => {
    if (busy.current) return;
    if (needsEntity) { setAssignOpen(true); say("술·음식을 먼저 지정하세요"); return; }
    if (!reason.trim()) { say("추천 이유를 적어 주세요 (카드에 그대로 표시됩니다)"); return; }
    busy.current = true;
    try {
      const r = await post("/admin/api/promote", { candidateId: c.id, score, tier, who: who.trim() || null, reason: reason.trim(), reviewer: reviewer || "운영자" });
      say(`승격 → ${r.status === "curated" ? "게시(curated)" : "보류(pending, 근거 " + r.evidence + "개)"}`);
      remove(c.id);
    } catch (e) { say((e as Error).message); } finally { busy.current = false; }
  };
  const doReject = async (why: string) => {
    if (busy.current) return; busy.current = true;
    try { await post("/admin/api/reject", { candidateId: c.id, reason: why, reviewer: reviewer || "운영자" }); say("거절"); remove(c.id); }
    catch (e) { say((e as Error).message); } finally { busy.current = false; }
  };

  return (
    <div id={`card-${c.id}`} className={`card ${selected ? "sel" : ""}`} onClick={onFocus}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="pair">{c.drinkName}<span className="x">✕</span>{c.foodName}</div>
        <div className="row">
          {c.gap && <span className="tag w">{c.gap === "both" ? "술·음식 첫 근거" : c.gap === "drink" ? "술 첫 근거" : "음식 첫 근거"}</span>}
          {c.mention_count > 1 && <span className="tag">언급 {c.mention_count}</span>}
          {c.siblings > 0 && <span className="tag m">같은 조합 후보 +{c.siblings}</span>}
          <span className="tag m">{c.source_kind || c.origin}</span>
        </div>
      </div>
      {c.existing && <p className="muted" style={{ marginTop: 4 }}>이미 페어링 있음 · 전문가 {c.existing.es} · 출처 {c.existing.src} — 승인하면 근거가 추가되고 등급이 높으면 갱신됩니다{c.sameUrl && <b style={{ color: "var(--warn)" }}> · 같은 URL 근거가 이미 등록됨 (거절 권장)</b>}</p>}
      {needsEntity && <p style={{ color: "var(--warn)", fontSize: 13, marginTop: 4 }}>술 또는 음식이 카탈로그와 매칭되지 않았어요 → 아래에서 지정</p>}
      {(c.quote || c.url) && (
        <div className="quote">
          {c.quote || "(인용문 없음)"}
          <div className="muted" style={{ marginTop: 4 }}>{c.source_name} {c.url && <a href={c.url} target="_blank" rel="noopener">원문 ↗</a>} {c.query && <span>· 검색어 “{c.query}”</span>}</div>
        </div>
      )}
      {assignOpen && <Assign c={c} onDone={(d) => { c.drink_id = d.drink_id; c.food_id = d.food_id; setAssignOpen(false); say("지정 완료"); }} />}
      <div className="grid3" style={{ marginTop: 8 }}>
        <div><label>출처 등급</label><select value={tier} onChange={(e) => { setTier(e.target.value); setScore(TIER_DEFAULT[e.target.value]); }}>{TIERS.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div><label>점수 (84~97)</label><input type="number" min={84} max={97} value={score} onChange={(e) => setScore(Number(e.target.value))} /></div>
        <div><label>추천자 (선택)</label><input value={who} onChange={(e) => setWho(e.target.value)} placeholder="이름·직함 / 매체명" /></div>
      </div>
      <div style={{ marginTop: 8 }}><label>추천 이유 * (앱 카드에 표시)</label><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예) 톡 쏘는 탄산과 산미가 파전의 기름기를 정리해 준다" /></div>
      <div className="row" style={{ marginTop: 10 }}>
        <button id={`approve-${c.id}`} className="btn p" onClick={approve}>승인 (A)</button>
        <button id={`reject-${c.id}`} className="btn d" onClick={() => setRejectOpen((v) => !v)}>거절 (R)</button>
        {needsEntity && !assignOpen && <button className="btn" onClick={() => setAssignOpen(true)}>술·음식 지정</button>}
        <span className="muted" style={{ marginLeft: "auto" }}>#{c.id} · {c.batch}</span>
      </div>
      {rejectOpen && <div className="row" style={{ marginTop: 8 }}>{REJECT_REASONS.map((r) => <button key={r} className="btn sm" onClick={() => doReject(r)}>{r}</button>)}</div>}
    </div>
  );
}

function Assign({ c, onDone }: { c: Card; onDone: (d: { drink_id: string | null; food_id: string | null }) => void }) {
  const [dq, setDq] = useState(c.drink_raw || ""); const [fq, setFq] = useState(c.food_raw || "");
  const [dr, setDr] = useState<{ id: string; name: string }[]>([]); const [fr, setFr] = useState<{ id: string; name: string }[]>([]);
  const [dId, setDId] = useState<string | null>(c.drink_id); const [fId, setFId] = useState<string | null>(c.food_id);
  const search = async (q: string, type: "drink" | "food") => {
    const r = await fetch(`/admin/api/search?q=${encodeURIComponent(q)}&type=${type}`); const j = await r.json();
    (type === "drink" ? setDr : setFr)(j.items || []);
  };
  useEffect(() => { if (dq) void search(dq, "drink"); if (fq) void search(fq, "food"); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => { const j = await post("/admin/api/assign", { candidateId: c.id, drinkId: dId, foodId: fId }); onDone(j); };
  return (
    <div className="card" style={{ background: "var(--bg)", marginTop: 8 }}>
      <div className="grid2">
        <div>
          <label>술 {dId && <span className="tag">선택됨</span>}</label>
          <input value={dq} onChange={(e) => { setDq(e.target.value); void search(e.target.value, "drink"); }} placeholder="술 이름 검색" />
          <div className="row" style={{ marginTop: 6 }}>{dr.map((x) => <button key={x.id} className={`btn sm ${dId === x.id ? "p" : ""}`} onClick={() => setDId(x.id)}>{x.name}</button>)}</div>
        </div>
        <div>
          <label>음식 {fId && <span className="tag v">선택됨</span>}</label>
          <input value={fq} onChange={(e) => { setFq(e.target.value); void search(e.target.value, "food"); }} placeholder="음식 이름 검색" />
          <div className="row" style={{ marginTop: 6 }}>{fr.map((x) => <button key={x.id} className={`btn sm ${fId === x.id ? "p" : ""}`} onClick={() => setFId(x.id)}>{x.name}</button>)}</div>
        </div>
      </div>
      <button className="btn" style={{ marginTop: 8 }} disabled={!dId || !fId} onClick={save}>지정 저장</button>
    </div>
  );
}
