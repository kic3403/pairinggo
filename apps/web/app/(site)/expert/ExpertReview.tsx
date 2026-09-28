"use client";
/**
 * 전문가 검수 — 탭 셋: 검수 대기열(/api/expert/queue) · 내 검수(/api/expert/reviews GET/DELETE) · 새 페어링 제안(술·음식 고르기 → 어울림).
 * 판정 저장은 POST /api/expert/reviews. 규칙 문구는 shared pairing/expert.ts.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EXPERT_NOTE_MAX, VERDICT_LABEL, expertReviewProblem, type ExpertVerdict } from "@pairinggo/shared/expert";
import { KIND_LABEL } from "@pairinggo/shared/kinds";

type DrinkKind = keyof typeof KIND_LABEL;
import { toSlug } from "@pairinggo/shared/slug";
import CatalogPicker, { type Opt } from "../_components/CatalogPicker";

type QueueItem = { d: string; f: string; drink: string; drinkSub: string; food: string; foodSub: string; kind: DrinkKind; grade: "best" | "good" | "try"; xp: { yes: number; no: number } | null; quote: string | null; who: string | null; source: string | null; reason: string };
type Mine = { id: number; drinkId: string; drinkName: string; foodId: string; foodName: string; verdict: ExpertVerdict; note: string; updatedAt: string };
const GRADE_LABEL = { best: "찰떡", good: "잘 어울림", try: "시도해 볼 만" } as const;
const KINDS: (DrinkKind | "")[] = ["", "trad", "whisky", "sake", "wine"];

async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

export default function ExpertReview({ displayName, drinks, foods }: { displayName: string; drinks: Opt[]; foods: Opt[] }) {
  const [tab, setTab] = useState<"queue" | "mine" | "new">("queue");
  const [kind, setKind] = useState<DrinkKind | "">("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<Mine[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const loadQueue = useCallback(async (k: DrinkKind | "", offset = 0) => {
    try {
      const j = (await api(`/api/expert/queue?kind=${k}&offset=${offset}`)) as { items: QueueItem[]; total: number };
      setQueue((prev) => (offset ? [...prev, ...j.items] : j.items)); setTotal(j.total);
    } catch (e) { say((e as Error).message); }
  }, []);
  const loadMine = useCallback(async () => {
    try { setMine(((await api("/api/expert/reviews")) as { items: Mine[] }).items); } catch (e) { say((e as Error).message); }
  }, []);
  useEffect(() => { void loadQueue(kind); }, [kind, loadQueue]);
  useEffect(() => { if (tab === "mine" && mine === null) void loadMine(); }, [tab, mine, loadMine]);

  async function save(drinkId: string, foodId: string, verdict: ExpertVerdict, note: string): Promise<boolean> {
    const problem = expertReviewProblem({ drinkId, foodId, verdict, note });
    if (problem) { say(problem); return false; }
    try {
      await api("/api/expert/reviews", { method: "POST", body: JSON.stringify({ drinkId, foodId, verdict, note }) });
      say(`${VERDICT_LABEL[verdict]}으로 저장했어요`);
      setQueue((q) => q.filter((x) => !(x.d === drinkId && x.f === foodId))); setTotal((t) => Math.max(0, t - 1)); setMine(null);
      return true;
    } catch (e) { say((e as Error).message); return false; }
  }
  async function remove(id: number) {
    if (!confirm("이 판정을 지울까요? 근거로 실린 줄도 함께 사라져요.")) return;
    try { await api(`/api/expert/reviews?id=${id}`, { method: "DELETE" }); setMine((m) => (m ?? []).filter((x) => x.id !== id)); say("지웠어요"); void loadQueue(kind); }
    catch (e) { say((e as Error).message); }
  }

  return (
    <>
      <ul className="tabs">
        <li><a href="#queue" className={tab === "queue" ? "on" : ""} onClick={(e) => { e.preventDefault(); setTab("queue"); }}>검수 대기 <span className="cnt">{total}</span></a></li>
        <li><a href="#mine" className={tab === "mine" ? "on" : ""} onClick={(e) => { e.preventDefault(); setTab("mine"); }}>내 검수{mine ? <span className="cnt">{mine.length}</span> : null}</a></li>
        <li><a href="#new" className={tab === "new" ? "on" : ""} onClick={(e) => { e.preventDefault(); setTab("new"); }}>새 페어링 제안</a></li>
      </ul>

      {tab === "queue" && (
        <>
          <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 12, border: 0, padding: 0 }}>
            {KINDS.map((k) => <button key={k} type="button" className={`btn sm${kind === k ? " p" : ""}`} onClick={() => setKind(k)}>{k ? KIND_LABEL[k] : "전체"}</button>)}
          </div>
          {queue.length === 0 ? <p className="muted">검수할 조합이 없어요.</p> : (
            <ul className="cards">{queue.map((q) => <QueueCard key={`${q.d}|${q.f}`} q={q} onSave={save} />)}</ul>
          )}
          {queue.length < total && <p style={{ textAlign: "center", marginTop: 14 }}><button type="button" className="btn" onClick={() => loadQueue(kind, queue.length)}>더 보기 ({queue.length}/{total})</button></p>}
        </>
      )}

      {tab === "mine" && (
        mine === null ? <p className="muted">불러오는 중…</p> : mine.length === 0 ? <p className="muted">아직 남긴 판정이 없어요.</p> : (
          <ul className="rows">
            {mine.map((m) => (
              <li key={m.id} className="row">
                <Link href={`/foods/${toSlug(m.foodName)}?d=${m.drinkId}`} className="grow"><b>{m.drinkName} <span className="muted">×</span> {m.foodName}</b><span className="small muted">{m.note || "이유 없음"} · {m.updatedAt.slice(0, 10).replace(/-/g, ".")}</span></Link>
                <span className={`xverdict ${m.verdict}`}>{VERDICT_LABEL[m.verdict]}</span>
                <button type="button" className="btn sm" onClick={() => remove(m.id)} aria-label="판정 지우기">지우기</button>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === "new" && <Propose drinks={drinks} foods={foods} displayName={displayName} onSave={save} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

function QueueCard({ q, onSave }: { q: QueueItem; onSave: (d: string, f: string, v: ExpertVerdict, note: string) => Promise<boolean> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<ExpertVerdict | null>(null);
  const go = async (v: ExpertVerdict) => { setBusy(v); const ok = await onSave(q.d, q.f, v, note); if (!ok) setBusy(null); };
  return (
    <li className="card xq">
      <div className="top">
        <span className="name"><Link href={`/drinks/${toSlug(q.drink)}`}>{q.drink}</Link> <span className="muted">×</span> <Link href={`/foods/${toSlug(q.food)}?d=${q.d}`}>{q.food}</Link></span>
        <span className={`grade ${q.grade}`} title="지금 등급">{GRADE_LABEL[q.grade]}</span>
      </div>
      <div className="small muted" style={{ marginTop: 2 }}>{q.drinkSub} · {q.foodSub}</div>
      {q.xp && (q.xp.yes > 0 || q.xp.no > 0) && <div className="small" style={{ marginTop: 6 }}>다른 전문가 {q.xp.yes ? `어울림 ${q.xp.yes}명` : ""}{q.xp.yes && q.xp.no ? " · " : ""}{q.xp.no ? `아님 ${q.xp.no}명` : ""}</div>}
      {q.quote ? <blockquote className="quote">“{q.quote}”{q.who && <span className="muted"> — {q.who}</span>}{!q.who && q.source && <span className="muted"> — {q.source}</span>}</blockquote>
        : q.reason ? <p className="why">{q.reason}</p> : null}
      <label className="mp-field" style={{ marginTop: 10 }}>
        <span>한 줄 이유 <span className="muted" style={{ fontWeight: 400 }}>{EXPERT_NOTE_MAX}자 · 아님이면 필수 · 카드에 보여요</span></span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={EXPERT_NOTE_MAX} placeholder="예: 산미가 기름진 전을 개운하게 정리해요" />
      </label>
      <div className="row" style={{ gap: 6, border: 0, padding: "6px 0 0" }}>
        <button type="button" className="btn sm xv yes" disabled={!!busy} onClick={() => go("yes")}>어울림</button>
        <button type="button" className="btn sm xv" disabled={!!busy} onClick={() => go("neutral")}>보통</button>
        <button type="button" className="btn sm xv no" disabled={!!busy} onClick={() => go("no")}>아님</button>
      </div>
    </li>
  );
}

function Propose({ drinks, foods, displayName, onSave }: { drinks: Opt[]; foods: Opt[]; displayName: string; onSave: (d: string, f: string, v: ExpertVerdict, note: string) => Promise<boolean> }) {
  const [drink, setDrink] = useState<{ q: string; picked: Opt | null }>({ q: "", picked: null });
  const [food, setFood] = useState<{ q: string; picked: Opt | null }>({ q: "", picked: null });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pick = (v: { q: string; picked: Opt | null }, options: Opt[]) => v.picked ?? options.find((o) => o.name.replace(/\s+/g, "") === v.q.trim().replace(/\s+/g, "")) ?? null;
  const d = pick(drink, drinks), f = pick(food, foods);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d || !f) return;
    setBusy(true);
    const ok = await onSave(d.id, f.id, "yes", note);
    if (ok) { setDrink({ q: "", picked: null }); setFood({ q: "", picked: null }); setNote(""); }
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="box" style={{ maxWidth: 520 }}>
      <h3>이 술엔 이 음식 — {displayName}의 추천</h3>
      <CatalogPicker label="술" placeholder="예: 복순도가, 화요" options={drinks} value={drink} onChange={setDrink} allowUnknown={false} />
      <CatalogPicker label="음식" placeholder="예: 육회, 감자전" options={foods} value={food} onChange={setFood} allowUnknown={false} />
      <label className="mp-field"><span>한 줄 이유 <span className="muted" style={{ fontWeight: 400 }}>{EXPERT_NOTE_MAX}자 · 카드에 보여요</span></span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={EXPERT_NOTE_MAX} placeholder="예: 은은한 단맛이 매운 양념을 감싸요" /></label>
      <p className="small muted">카탈로그에 없는 술·음식은 <Link href="/search">검색 화면</Link>에서 추가 요청해 주세요. 제안은 곧바로 "어울림" 판정으로 실려요.</p>
      <button type="submit" className="btn p" disabled={busy || !d || !f} style={{ width: "100%" }}>{busy ? "저장 중…" : "어울림으로 저장"}</button>
    </form>
  );
}
