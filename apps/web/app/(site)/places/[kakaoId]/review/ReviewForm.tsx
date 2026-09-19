"use client";
/**
 * 리뷰 쓰기 — ① 로그인 ② 휴대폰 인증(1인 1계정) ③ 방문 인증(앱 예약 방문 완료 고르기 또는 영수증 사진) ④ 별점·글(10~500자)·사진(5장)
 * 영수증 사진은 읽고 버린다(서버가 30분짜리 인증 표만 준다). 리뷰 사진은 긴 변 1,280px JPEG로 줄여 한 장씩 올린다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEW_PHOTOS_MAX } from "@pairinggo/shared";
import { shrinkToJpeg } from "@pairinggo/shared/image-client";
import { useSaved } from "../../../_components/SavedProvider";
import PhoneVerify from "../../../_components/PhoneVerify";
import { track } from "@/lib/track";

type Gate = { loggedIn: boolean; phoneVerified?: boolean; ownerBlocked?: boolean; receiptAvailable?: boolean; reservations?: { id: string; date: string; time: string }[] };
type Visit = { kind: "reservation"; id: string; label: string } | { kind: "receipt"; ticket: string; label: string };

const md = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8, 10))}일`;
const LABELS = ["", "별로예요", "아쉬워요", "괜찮아요", "좋아요", "최고예요"];

export default function ReviewForm({ kakaoId, placeName, back }: { kakaoId: string; placeName: string; back: string }) {
  const { ready, loggedIn } = useSaved();
  const path = usePathname(), sp = useSearchParams();
  const next = `${path}${sp.toString() ? `?${sp}` : ""}`;
  const [gate, setGate] = useState<Gate | null>(null);
  const [smsReady, setSmsReady] = useState(true);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptErr, setReceiptErr] = useState("");
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoBusy, setPhotoBusy] = useState(0);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch(`/api/reviews?kakao=${kakaoId}`, { cache: "no-store" }).then((r) => r.json()).then(setGate).catch(() => setGate({ loggedIn: false }));
  useEffect(() => {
    if (!ready || !loggedIn) return;
    void load();
    fetch("/api/phone", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => j && setSmsReady(!!j.available)).catch(() => {});
  }, [ready, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  async function receipt(file: File | undefined) {
    if (!file || receiptBusy) return;
    setReceiptBusy(true); setReceiptErr("");
    try {
      const { data } = await shrinkToJpeg(file);
      const r = await fetch("/api/reviews/receipt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kakaoId, placeName, image: data }) });
      const j = (await r.json().catch(() => ({}))) as { ticket?: string; visitDate?: string; storeName?: string; error?: string };
      if (!r.ok || !j.ticket) throw new Error(j.error ?? "영수증을 확인하지 못했어요");
      setVisit({ kind: "receipt", ticket: j.ticket, label: `영수증 인증 · ${md(j.visitDate!)} 방문${j.storeName ? ` (${j.storeName})` : ""}` });
    } catch (e) { setReceiptErr((e as Error).message); } finally { setReceiptBusy(false); }
  }

  async function addPhotos(files: FileList | null) {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, REVIEW_PHOTOS_MAX - photos.length - photoBusy);
    if (!list.length) return;
    setErr(""); setPhotoBusy((n) => n + list.length);
    for (const f of list) {
      try {
        const { data } = await shrinkToJpeg(f, 1280);
        const r = await fetch("/api/reviews/photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data }) });
        const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
        if (!r.ok || !j.url) throw new Error(j.error ?? "사진을 올리지 못했어요");
        setPhotos((p) => (p.length < REVIEW_PHOTOS_MAX ? [...p, j.url!] : p));
      } catch (e) { setErr((e as Error).message); } finally { setPhotoBusy((n) => n - 1); }
    }
  }

  async function submit() {
    if (!visit) { setErr("방문 인증을 먼저 해 주세요"); return; }
    if (!rating) { setErr("별점을 골라 주세요"); return; }
    if (body.trim().length < REVIEW_BODY_MIN) { setErr(`리뷰를 ${REVIEW_BODY_MIN}자 이상 적어 주세요`); return; }
    setBusy(true); setErr("");
    const r = await fetch("/api/reviews", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kakaoId, placeName, rating, body, photos, reservationId: visit.kind === "reservation" ? visit.id : null, receiptTicket: visit.kind === "receipt" ? visit.ticket : null }),
    }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (r?.ok) { track("review_submit", { kakao: kakaoId, verify: visit.kind, photos: photos.length }); location.href = `${back}#reviews`; return; }
    setBusy(false); setErr(j?.error ?? "저장하지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  }

  if (!ready) return null;
  if (!loggedIn) {
    return (
      <section className="rvw-step">
        <p className="muted">리뷰는 로그인한 회원이 방문을 인증한 뒤 쓸 수 있어요.</p>
        <Link className="btn p" href={`/login?next=${encodeURIComponent(next)}`}>로그인하고 리뷰 쓰기</Link>
      </section>
    );
  }
  if (!gate) return <p className="muted">확인하는 중…</p>;
  if (gate.ownerBlocked) return <p className="form-error">이 매장의 파트너(사장님·직원) 번호로 인증한 계정이라 이 매장에는 리뷰를 쓸 수 없어요.</p>;
  if (!gate.phoneVerified) {
    return (
      <section className="rvw-step">
        <h2>1. 휴대폰 인증</h2>
        <PhoneVerify available={smsReady} onDone={() => void load()}
          note="가짜 리뷰를 막으려고 휴대폰을 인증한 회원만 리뷰를 쓸 수 있어요(1인 1계정). 번호는 공개되지 않아요."
          unavailable="문자 인증을 준비하고 있어요 — 곧 리뷰를 쓸 수 있어요." />
      </section>
    );
  }

  return (
    <div className="rvw-form">
      <section className="rvw-step">
        <h2>1. 방문 인증</h2>
        {visit ? (
          <div className="rvw-ok">
            <span>✓ {visit.label}</span>
            <button type="button" className="linklike" onClick={() => setVisit(null)}>바꾸기</button>
          </div>
        ) : (
          <>
            {gate.reservations?.length ? (
              <div className="rvw-resv">
                <p className="small muted" style={{ margin: "0 0 6px" }}>페어링GO로 예약해 방문한 기록</p>
                {gate.reservations.map((r) => (
                  <button key={r.id} type="button" className="btn" onClick={() => setVisit({ kind: "reservation", id: r.id, label: `예약 방문 · ${md(r.date)} ${r.time}` })}>
                    {md(r.date)} {r.time} 예약 방문으로 쓰기
                  </button>
                ))}
              </div>
            ) : null}
            {gate.receiptAvailable ? (
              <div className="rvw-receipt">
                <p className="small muted" style={{ margin: "8px 0 6px" }}>
                  {gate.reservations?.length ? "또는 " : ""}<b>영수증 사진</b>으로 인증 — 최근 30일 안에 이 매장에서 받은 영수증(카드 전표·현금영수증). 상호·날짜·금액만 읽고 사진은 저장하지 않아요. 영수증 하나로 리뷰 하나.
                </p>
                <label className={`btn p${receiptBusy ? " is-busy" : ""}`}>
                  {receiptBusy ? "영수증 읽는 중… (5~15초)" : "영수증 사진 올리기"}
                  <input type="file" accept="image/*" hidden disabled={receiptBusy} onChange={(e) => { void receipt(e.target.files?.[0]); e.target.value = ""; }} />
                </label>
                {receiptErr ? <p className="form-error" role="alert">{receiptErr}</p> : null}
              </div>
            ) : !gate.reservations?.length ? <p className="form-error">영수증 인증을 준비하고 있어요 — 페어링GO로 예약해 방문하면 리뷰를 쓸 수 있어요.</p> : null}
          </>
        )}
      </section>

      <section className={`rvw-step${visit ? "" : " dim"}`}>
        <h2>2. 별점</h2>
        <div className="rvw-stars" role="radiogroup" aria-label="별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n}점 ${LABELS[n]}`} className={n <= rating ? "on" : ""} onClick={() => setRating(n)}>★</button>
          ))}
          <span className="small muted">{rating ? LABELS[rating] : "눌러서 골라 주세요"}</span>
        </div>
      </section>

      <section className={`rvw-step${visit ? "" : " dim"}`}>
        <h2>3. 리뷰</h2>
        <label className="field">
          <span>어떤 메뉴와 술을 드셨나요? 맛·분위기·페어링을 알려 주세요 <i className="muted">({body.trim().length}/{REVIEW_BODY_MAX}자, {REVIEW_BODY_MIN}자 이상)</i></span>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, REVIEW_BODY_MAX))} rows={6} placeholder="예: 수육이 부드럽고 한산소곡주와 잘 어울렸어요. 콜키지는 병당 1만원이었어요." />
        </label>
        <div className="rvw-photos">
          {photos.map((u) => (
            <div key={u} className="rvw-ph"><img src={u} alt="" /><button type="button" aria-label="사진 빼기" onClick={() => setPhotos((p) => p.filter((x) => x !== u))}>×</button></div>
          ))}
          {photos.length + photoBusy < REVIEW_PHOTOS_MAX ? (
            <label className="rvw-ph add">
              <span>{photoBusy ? "올리는 중…" : `+ 사진 (${photos.length}/${REVIEW_PHOTOS_MAX})`}</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} />
            </label>
          ) : null}
        </div>
        <p className="small muted" style={{ margin: "6px 0 0" }}>직접 찍은 사진만 올려 주세요. 다른 사람 얼굴·차량 번호가 보이지 않게 해 주세요.</p>
      </section>

      {err ? <p className="form-error" role="alert">{err}</p> : null}
      <button type="button" className="btn p" style={{ width: "100%" }} disabled={busy || !visit || photoBusy > 0} onClick={submit}>{busy ? "올리는 중…" : "리뷰 올리기"}</button>
      <p className="small muted" style={{ marginTop: 10 }}>욕설·광고·허위 사실·개인정보가 담긴 리뷰는 신고를 받아 숨겨질 수 있어요. 리뷰는 닉네임과 함께 모든 사람에게 공개돼요.</p>
    </div>
  );
}
