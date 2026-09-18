"use client";
import { useState } from "react";
import { slotTimes, WEEKDAY_LABEL, type BusinessHours, type ReservationSettings } from "@pairinggo/shared";

type Msg = { busy?: boolean; ok?: string; err?: string };
async function post(url: string, body: unknown): Promise<{ ok: boolean; j: Record<string, unknown> }> {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!r?.ok, j: ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
}
const Note = ({ m }: { m: Msg }) => (m.err ? <p className="err" role="alert">{m.err}</p> : m.ok ? <p className="okmsg" role="status">{m.ok}</p> : null);

/* ---------- 예약 받기·정원 ---------- */
export function SettingsForm({ initial, hoursSaved }: { initial: ReservationSettings; hoursSaved: boolean }) {
  const [s, setS] = useState(initial);
  const [m, setM] = useState<Msg>({});
  const num = (k: keyof ReservationSettings) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setS({ ...s, [k]: Number(e.target.value) });
  async function save(next = s) {
    setM({ busy: true });
    const r = await post("/api/settings", next);
    if (r.ok) { setS(r.j.settings as ReservationSettings); setM({ ok: next.accepting ? "저장했어요 — 페어링GO 손님이 지금부터 예약할 수 있어요" : "저장했어요 — 예약 받기는 꺼져 있어요" }); }
    else { setM({ err: String(r.j.error ?? "저장하지 못했어요") }); if (next.accepting !== s.accepting) setS({ ...next, accepting: s.accepting }); }
  }
  return (
    <section className="panel stack">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>예약 받기</h2>
          <p className="small muted" style={{ margin: "2px 0 0" }}>켜면 정한 정원 안에서 손님 예약이 <b>바로 확정</b>돼요.</p>
        </div>
        <button type="button" role="switch" aria-checked={s.accepting} className={`btn ${s.accepting ? "primary" : "ghost"}`} disabled={m.busy}
          onClick={() => { const next = { ...s, accepting: !s.accepting }; setS(next); save(next); }}>
          {s.accepting ? "받는 중" : "꺼짐"}
        </button>
      </div>
      {!hoursSaved ? <p className="small" style={{ margin: 0, color: "var(--warn)" }}>아래 영업시간을 먼저 저장해야 켤 수 있어요.</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))", gap: 12, alignItems: "end" }}>
        <label className="f">예약 간격
          <select value={s.slotMinutes} onChange={num("slotMinutes")}>{[15, 30, 60].map((v) => <option key={v} value={v}>{v}분마다</option>)}</select>
        </label>
        <label className="f">한 시간대 최대 팀<input type="number" min={1} max={50} value={s.capacityParties} onChange={num("capacityParties")} /></label>
        <label className="f">한 시간대 최대 인원 <span className="hint">0 = 제한 없음</span><input type="number" min={0} max={300} value={s.capacityPeople} onChange={num("capacityPeople")} /></label>
        <label className="f">최소 인원<input type="number" min={1} max={20} value={s.minParty} onChange={num("minParty")} /></label>
        <label className="f">최대 인원<input type="number" min={1} max={50} value={s.maxParty} onChange={num("maxParty")} /></label>
        <label className="f">당일 마감 <span className="hint">방문 몇 분 전까지</span>
          <select value={s.leadMinutes} onChange={num("leadMinutes")}>{[0, 30, 60, 120, 180, 360, 1440].map((v) => <option key={v} value={v}>{v === 0 ? "바로 전까지" : v === 1440 ? "하루 전까지" : `${v >= 60 ? `${v / 60}시간` : `${v}분`} 전까지`}</option>)}</select>
        </label>
        <label className="f">며칠 뒤까지 받기
          <select value={s.horizonDays} onChange={num("horizonDays")}>{[7, 14, 30, 60, 90].map((v) => <option key={v} value={v}>{v}일</option>)}</select>
        </label>
      </div>
      <label className="check"><input type="checkbox" checked={s.roomBookable} onChange={(e) => setS({ ...s, roomBookable: e.target.checked })} /><span>룸 희망을 받아요(손님이 예약할 때 “룸 희망”을 고를 수 있어요)</span></label>
      <label className="f">예약 안내 <span className="hint">예약 화면 위에 보여요(200자)</span>
        <textarea value={s.notice} onChange={(e) => setS({ ...s, notice: e.target.value })} maxLength={200} placeholder="예: 7인 이상 단체는 전화로 문의해 주세요. 노쇼 2회 시 예약이 제한될 수 있어요." />
      </label>
      <Note m={m} />
      <button className="btn primary block" disabled={m.busy} onClick={() => save()}>{m.busy ? "저장하는 중…" : "예약 설정 저장"}</button>
    </section>
  );
}

/* ---------- 영업시간 ---------- */
export function HoursForm({ initial, slotMinutes }: { initial: BusinessHours[]; slotMinutes: number }) {
  const [h, setH] = useState(initial);
  const [m, setM] = useState<Msg>({});
  const set = (wd: number, patch: Partial<BusinessHours>) => setH(h.map((x) => (x.weekday === wd ? { ...x, ...patch } : x)));
  const order = [1, 2, 3, 4, 5, 6, 0]; // 월요일부터
  function copyToAll(wd: number) {
    const src = h.find((x) => x.weekday === wd)!;
    setH(h.map((x) => (x.closed ? x : { ...x, open: src.open, close: src.close, breakStart: src.breakStart, breakEnd: src.breakEnd })));
  }
  async function save() {
    setM({ busy: true });
    const r = await post("/api/hours", { hours: h });
    if (r.ok) { setH(r.j.hours as BusinessHours[]); setM({ ok: "영업시간을 저장했어요" }); } else setM({ err: String(r.j.error ?? "저장하지 못했어요") });
  }
  return (
    <section className="panel stack">
      <div>
        <h2 style={{ margin: 0 }}>영업시간</h2>
        <p className="small muted" style={{ margin: "2px 0 0" }}>예약 시간은 여는 시각부터 {slotMinutes}분마다, 마지막 입장은 닫기 {slotMinutes}분 전이에요. 브레이크 타임엔 예약을 받지 않아요. 새벽까지 여는 날은 자정 전까지만 예약을 받아요.</p>
      </div>
      {order.map((wd) => {
        const x = h.find((y) => y.weekday === wd)!;
        const slots = slotTimes(x, slotMinutes);
        return (
          <div key={wd} style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ width: 22 }}>{WEEKDAY_LABEL[wd]}</b>
              <label className="check" style={{ margin: 0 }}><input type="checkbox" checked={x.closed} onChange={(e) => set(wd, { closed: e.target.checked })} /><span>쉬는 날</span></label>
              {!x.closed ? <button type="button" className="linklike" onClick={() => copyToAll(wd)}>이 시간을 여는 날 모두에</button> : null}
              {!x.closed ? <span className="small muted num" style={{ marginLeft: "auto" }}>{slots.length ? `${slots[0]}~${slots.at(-1)} 입장 · ${slots.length}칸` : "예약 시간 없음"}</span> : null}
            </div>
            {!x.closed ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, alignItems: "end" }}>
                <label className="f"><span className="hint">여는 시각</span><input type="time" value={x.open} onChange={(e) => set(wd, { open: e.target.value })} /></label>
                <label className="f"><span className="hint">닫는 시각</span><input type="time" value={x.close} onChange={(e) => set(wd, { close: e.target.value })} /></label>
                <label className="f"><span className="hint">브레이크 시작(선택)</span><input type="time" value={x.breakStart ?? ""} onChange={(e) => set(wd, { breakStart: e.target.value || null })} /></label>
                <label className="f"><span className="hint">브레이크 끝</span><input type="time" value={x.breakEnd ?? ""} onChange={(e) => set(wd, { breakEnd: e.target.value || null })} /></label>
              </div>
            ) : null}
          </div>
        );
      })}
      <Note m={m} />
      <button className="btn primary block" disabled={m.busy} onClick={save}>{m.busy ? "저장하는 중…" : "영업시간 저장"}</button>
    </section>
  );
}

/* ---------- 임시 휴무 ---------- */
export function ClosuresForm({ initial, today }: { initial: { day: string; note: string }[]; today: string }) {
  const [list, setList] = useState(initial);
  const [day, setDay] = useState("");
  const [note, setNote] = useState("");
  const [m, setM] = useState<Msg>({});
  async function change(op: "add" | "remove", d: string) {
    setM({ busy: true });
    const r = await post("/api/closures", { op, day: d, note: op === "add" ? note : "" });
    if (!r.ok) { setM({ err: String(r.j.error ?? "저장하지 못했어요") }); return; }
    setList(r.j.closures as { day: string; note: string }[]);
    const booked = Number(r.j.bookedThatDay ?? 0);
    setM({ ok: op === "add" ? (booked ? `휴무로 정했어요. 그날 이미 확정된 예약이 ${booked}건 있어요 — 손님께 연락하거나 오늘 탭에서 매장 취소해 주세요` : "휴무로 정했어요 — 그날은 예약을 받지 않아요") : "휴무를 풀었어요" });
    if (op === "add") { setDay(""); setNote(""); }
  }
  return (
    <section className="panel stack">
      <div>
        <h2 style={{ margin: 0 }}>임시 휴무</h2>
        <p className="small muted" style={{ margin: "2px 0 0" }}>명절·개인 사정으로 쉬는 날. 그날은 예약을 받지 않아요.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: 8, alignItems: "end" }}>
        <label className="f"><span className="hint">날짜</span><input type="date" min={today} value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="f"><span className="hint">메모(선택)</span><input type="text" value={note} onChange={(e) => setNote(e.target.value)} maxLength={40} placeholder="예: 추석" /></label>
        <button type="button" className="btn ghost" disabled={!day || m.busy} onClick={() => change("add", day)}>추가</button>
      </div>
      {list.length ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
          {list.map((c) => (
            <li key={c.day} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span className="num">{c.day} ({WEEKDAY_LABEL[new Date(`${c.day}T00:00:00Z`).getUTCDay()]}){c.note ? <span className="muted"> · {c.note}</span> : null}</span>
              <button type="button" className="btn ghost sm" disabled={m.busy} onClick={() => change("remove", c.day)}>풀기</button>
            </li>
          ))}
        </ul>
      ) : <p className="small muted" style={{ margin: 0 }}>정한 휴무가 없어요.</p>}
      <Note m={m} />
    </section>
  );
}
