"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { addDays, formatVisit, pairingNoteDraft, RESERVATION_NOTE_MAX, weekdayOf, WEEKDAY_LABEL, type BusinessHours, type ReservationSettings } from "@pairinggo/shared";
import { useSaved } from "../../_components/SavedProvider";
import { track } from "@/lib/track";

type Named = { id: string; name: string };
type Slot = { time: string; available: boolean; few: boolean };
type Day = { date: string; reason: string; slots: Slot[] };
type Phone = { phone: string | null; verified: boolean; available: boolean };
type Props = {
  kakaoId: string; storeName: string; today: string;
  settings: Pick<ReservationSettings, "minParty" | "maxParty" | "horizonDays" | "leadMinutes" | "roomBookable" | "notice" | "slotMinutes">;
  hours: BusinessHours[]; closures: string[]; corkage: "yes" | "no" | null; corkageNote: string; food: Named | null; drink: Named | null;
};

const REASON: Record<string, string> = { closed: "쉬는 날이에요", past: "지난 날짜예요", beyond_horizon: "아직 예약을 받지 않는 날짜예요", not_accepting: "지금은 예약을 받지 않아요" };
const post = async (url: string, body: unknown) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  return { ok: !!r?.ok, status: r?.status ?? 0, j: ((await r?.json().catch(() => ({}))) ?? {}) as Record<string, string> };
};

/** 휴대폰 문자 인증 — 예약 정보를 매장에 전달하고 확정 안내를 받는 번호 */
function PhoneVerify({ onDone, available }: { onDone: (masked: string) => void; available: boolean }) {
  const [phone, setPhone] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ err?: string; ok?: string }>({});
  const [busy, setBusy] = useState(false);
  if (!available) return <p className="form-error">문자 인증을 준비하고 있어요 — 곧 앱에서 예약할 수 있어요. 급하면 매장에 전화해 주세요.</p>;
  async function start() {
    setBusy(true);
    const r = await post("/api/phone", { op: "start", phone });
    setBusy(false);
    if (r.ok) { setSent(true); setMsg({ ok: `${r.j.phone}로 인증번호를 보냈어요(3분)` }); } else setMsg({ err: r.j.error ?? "보내지 못했어요" });
  }
  async function confirm() {
    setBusy(true);
    const r = await post("/api/phone", { op: "confirm", code });
    setBusy(false);
    if (r.ok) onDone(r.j.phone); else setMsg({ err: r.j.error ?? "확인하지 못했어요" });
  }
  return (
    <div>
      <p className="small muted" style={{ margin: "0 0 10px" }}>예약 정보를 매장에 전달하고 확정 안내를 받을 번호예요. 한 번만 인증하면 돼요.</p>
      <div className="rsv-phone">
        <label className="field"><span>휴대폰 번호</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" /></label>
        <button type="button" className="btn" disabled={busy || phone.replace(/\D/g, "").length < 10} onClick={start}>{sent ? "다시 받기" : "인증번호 받기"}</button>
      </div>
      {sent ? (
        <div className="rsv-phone" style={{ marginTop: 8 }}>
          <label className="field"><span>인증번호 6자리</span><input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /></label>
          <button type="button" className="btn p" disabled={busy || code.length !== 6} onClick={confirm}>확인</button>
        </div>
      ) : null}
      {msg.err ? <p className="form-error" role="alert">{msg.err}</p> : msg.ok ? <p className="form-ok" role="status">{msg.ok}</p> : null}
    </div>
  );
}

export default function ReserveForm(p: Props) {
  const { ready, loggedIn } = useSaved();
  const pathname = usePathname(), search = useSearchParams();
  const next = `${pathname}${search.toString() ? `?${search}` : ""}`;
  const s = p.settings;

  const days = useMemo(() => {
    const n = Math.min(s.horizonDays, 45);
    return Array.from({ length: n + 1 }, (_, i) => {
      const date = addDays(p.today, i), wd = weekdayOf(date);
      const h = p.hours.find((x) => x.weekday === wd);
      return { date, wd, off: !h || h.closed || p.closures.includes(date) };
    });
  }, [p.today, p.hours, p.closures, s.horizonDays]);

  const [date, setDate] = useState(() => days.find((d) => !d.off)?.date ?? p.today);
  const [party, setParty] = useState(Math.min(s.maxParty, Math.max(s.minParty, 2)));
  const [day, setDay] = useState<Day | null>(null);
  const [time, setTime] = useState("");
  const [phone, setPhone] = useState<Phone | null>(null);
  const [name, setName] = useState("");
  const [room, setRoom] = useState(false);
  const [byo, setByo] = useState(false);
  const [note, setNote] = useState(() => pairingNoteDraft(p.food?.name, p.drink?.name, false));
  const [noteEdited, setNoteEdited] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState<{ text: string; need?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string } | null>(null);

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/phone", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setPhone(j)).catch(() => {});
  }, [loggedIn]);

  useEffect(() => {
    let alive = true;
    setDay(null);
    fetch(`/api/v1/reservations/availability?kakao=${p.kakaoId}&date=${date}&party=${party}`, { cache: "no-store" })
      .then((r) => r.json()).then((j: Day) => { if (!alive) return; setDay(j); if (!j.slots?.some((x) => x.time === time && x.available)) setTime(""); })
      .catch(() => alive && setDay({ date, reason: "error", slots: [] }));
    return () => { alive = false; };
  }, [p.kakaoId, date, party]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!noteEdited) setNote(pairingNoteDraft(p.food?.name, p.drink?.name, byo)); }, [byo, noteEdited, p.food?.name, p.drink?.name]);

  async function submit() {
    setErr(null);
    if (!time) { setErr({ text: "시간을 골라 주세요" }); return; }
    if (!name.trim()) { setErr({ text: "예약자 이름을 적어 주세요" }); return; }
    if (!agree) { setErr({ text: "예약 정보를 매장에 전달하는 데 동의해 주세요" }); return; }
    setBusy(true);
    track("reserve_submit", { place: p.storeName, ...(p.food ? { f: p.food.id } : {}), ...(p.drink ? { d: p.drink.id } : {}) });
    const r = await post("/api/reservations", {
      kakaoId: p.kakaoId, date, time, partySize: party, guestName: name, note, roomRequested: room, bringOwnDrink: byo,
      drinkId: p.drink?.id ?? null, foodId: p.food?.id ?? null, shareConsent: agree,
    });
    setBusy(false);
    if (r.ok) { setDone({ code: r.j.code }); track("reserve_confirmed", { place: p.storeName, party }); window.scrollTo({ top: 0 }); return; }
    track("reserve_fail", { place: p.storeName, status: r.status });
    setErr({ text: r.j.error ?? "예약하지 못했어요 — 잠시 뒤 다시 시도해 주세요", need: r.j.need });
    if (r.status === 409) setDay(null), fetch(`/api/v1/reservations/availability?kakao=${p.kakaoId}&date=${date}&party=${party}`, { cache: "no-store" }).then((x) => x.json()).then(setDay).catch(() => {});
    if (r.j.need === "phone") setPhone((ph) => (ph ? { ...ph, verified: false } : ph));
  }

  if (done) {
    return (
      <section className="rsv-done">
        <p className="muted" style={{ margin: 0 }}>예약이 확정됐어요</p>
        <div className="code">{done.code}</div>
        <p style={{ margin: "0 0 4px" }}><b>{p.storeName}</b></p>
        <p style={{ margin: 0 }}>{formatVisit(date, time)} · {party}명</p>
        <p className="small muted" style={{ marginTop: 10 }}>방문 1시간 전까지 내 예약에서 취소할 수 있어요. 그 뒤에는 매장에 전화해 주세요.</p>
        <div className="btns" style={{ justifyContent: "center" }}>
          <Link className="btn p" href="/my/reservations">내 예약 보기</Link>
          {p.food ? <Link className="btn" href="/">홈으로</Link> : null}
        </div>
      </section>
    );
  }

  const selectedOk = !!time && day?.slots.some((x) => x.time === time && x.available);
  return (
    <div>
      <section className="rsv-step">
        <h2>날짜</h2>
        <div className="rsv-days" role="group" aria-label="방문 날짜">
          {days.map((d) => (
            <button key={d.date} type="button" className={`rsv-day${d.wd === 0 ? " sun" : ""}`} aria-pressed={d.date === date} disabled={d.off}
              onClick={() => setDate(d.date)} aria-label={`${formatVisit(d.date, "").trim()}${d.off ? " 휴무" : ""}`}>
              <span>{d.date === p.today ? "오늘" : `${Number(d.date.slice(5, 7))}월`}</span>
              <b>{Number(d.date.slice(8))}</b>
              <span>{d.off ? "휴무" : WEEKDAY_LABEL[d.wd]}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="rsv-step">
        <h2>인원 <small>{s.minParty}~{s.maxParty}명</small></h2>
        <div className="rsv-party">
          <button type="button" aria-label="한 명 줄이기" disabled={party <= s.minParty} onClick={() => setParty(party - 1)}>−</button>
          <output aria-live="polite">{party}명</output>
          <button type="button" aria-label="한 명 늘리기" disabled={party >= s.maxParty} onClick={() => setParty(party + 1)}>+</button>
        </div>
      </section>

      <section className="rsv-step">
        <h2>시간 <small>{formatVisit(date, "").trim()}</small></h2>
        {!day ? <p className="muted">예약 가능한 시간을 불러오는 중…</p>
          : day.reason !== "ok" ? <p className="muted">{REASON[day.reason] ?? "시간을 불러오지 못했어요"}</p>
          : !day.slots.length ? <p className="muted">오늘은 더 받을 수 있는 시간이 없어요 — 다른 날짜를 골라 주세요.</p>
          : !day.slots.some((x) => x.available) ? <p className="muted">{party}명이 앉을 자리가 남은 시간이 없어요 — 다른 날짜나 인원으로 찾아보세요.</p>
          : null}
        {day?.slots.length ? (
          <div className="rsv-times" role="group" aria-label="방문 시간">
            {day.slots.map((x) => (
              <button key={x.time} type="button" className="rsv-time" aria-pressed={x.time === time} disabled={!x.available} onClick={() => setTime(x.time)}>
                {x.time}{x.few ? <i>1자리</i> : null}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className="rsv-step">
        <h2>예약자</h2>
        {!ready ? null : !loggedIn ? (
          <div>
            <p className="muted" style={{ margin: "0 0 10px" }}>예약하려면 로그인해 주세요. 고른 날짜·시간은 로그인 뒤 다시 골라 주세요.</p>
            <Link className="btn p" href={`/login?next=${encodeURIComponent(next)}`}>로그인하고 예약하기</Link>
          </div>
        ) : !phone ? <p className="muted">확인하는 중…</p> : !phone.verified ? (
          <PhoneVerify available={phone.available} onDone={(masked) => setPhone({ phone: masked, verified: true, available: true })} />
        ) : (
          <>
            <p className="small muted" style={{ margin: "0 0 10px" }}>연락처 {phone.phone} (인증됨)</p>
            <label className="field"><span>예약자 이름</span><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoComplete="name" placeholder="방문하실 분 이름" /></label>
            {s.roomBookable ? <label className="rsv-check"><input type="checkbox" checked={room} onChange={(e) => setRoom(e.target.checked)} /><span>룸을 원해요 <span className="muted small">(자리 사정에 따라 매장이 정해요)</span></span></label> : null}
            {p.corkage === "no" ? <p className="small muted">이 매장은 술을 가져가는 콜키지를 받지 않아요.</p> : (
              <label className="rsv-check"><input type="checkbox" checked={byo} onChange={(e) => setByo(e.target.checked)} />
                <span>술을 가져갈게요(콜키지) <span className="muted small">{p.corkage === "yes" ? `콜키지 가능${p.corkageNote ? ` · ${p.corkageNote}` : ""}` : "콜키지 여부·비용은 매장에 확인해 주세요"}</span></span>
              </label>
            )}
            <label className="field" style={{ marginTop: 10 }}><span>요청사항 <span className="muted">(선택, {RESERVATION_NOTE_MAX}자)</span></span>
              <textarea value={note} maxLength={RESERVATION_NOTE_MAX} onChange={(e) => { setNote(e.target.value); setNoteEdited(true); }} placeholder="예: 아이 의자 1개 부탁드려요" />
            </label>
          </>
        )}
      </section>

      {loggedIn && phone?.verified ? (
        <section className="rsv-step">
          <div className="rsv-sum">
            <b>{p.storeName}</b>
            <div>{selectedOk ? formatVisit(date, time) : `${formatVisit(date, "").trim()} · 시간을 골라 주세요`} · {party}명{room ? " · 룸 희망" : ""}{byo ? " · 술 지참" : ""}</div>
          </div>
          <label className="rsv-check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span>예약 정보(예약자 이름·휴대폰 번호·일시·인원·요청사항)를 <b>{p.storeName}</b>에 제공하는 데 동의합니다. <Link href="/privacy" target="_blank">자세히</Link></span>
          </label>
          <p className="small muted" style={{ margin: "4px 0 12px" }}>정원 안이면 바로 확정돼요. 방문 1시간 전까지 앱에서 취소할 수 있고, 연락 없이 오지 않으면 다음 예약이 제한될 수 있어요.</p>
          {err ? <p className="form-error" role="alert">{err.text}{err.need === "consent" ? <> — <Link href="/profile">약관 동의하러 가기</Link></> : null}</p> : null}
          <button type="button" className="btn f" style={{ width: "100%" }} disabled={busy || !selectedOk} onClick={submit}>{busy ? "예약하는 중…" : selectedOk ? `${time} ${party}명 예약하기` : "시간을 골라 주세요"}</button>
        </section>
      ) : null}
    </div>
  );
}
