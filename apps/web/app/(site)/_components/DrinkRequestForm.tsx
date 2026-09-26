"use client";
/**
 * 없는 술 추가 요청 폼(docs/25 §5) — 검색 결과가 없거나 라벨을 못 찾았을 때. 로그인은 선택.
 * 보내면 "요청했어요" + (회원이면) 마이페이지에서 결과를 본다는 안내. 운영자는 /admin/wanted에서 본다.
 */
import Link from "next/link";
import { useState } from "react";
import { DRINK_REQUEST_MEMO_MAX, DRINK_REQUEST_QUERY_MAX } from "@pairinggo/shared/drink-request";
import { useSaved } from "./SavedProvider";
import { track } from "@/lib/track";

export default function DrinkRequestForm({ query, source = "search", compact = false }: { query: string; source?: "search" | "label"; compact?: boolean }) {
  const { ready, loggedIn } = useSaved();
  const [name, setName] = useState(query);
  const [memo, setMemo] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; loggedIn: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/drink-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: name, memo, source }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "요청을 보내지 못했어요");
      setDone({ id: j.request.id, loggedIn: !!j.loggedIn });
      track("drink_request", { q: name, source });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="box request-box done" role="status">
        <b>‘{name}’ 추가를 요청했어요. 고마워요!</b>
        <p className="small muted" style={{ margin: "6px 0 0" }}>
          {done.loggedIn ? <>확인해서 넣으면 <Link href="/my#requests">마이페이지</Link>에 “등록됨”으로 알려 드려요.</> : <>확인해서 카탈로그에 넣을게요. <Link href="/login">로그인</Link>하고 요청하면 등록 소식을 마이페이지에서 볼 수 있어요.</>}
        </p>
      </div>
    );
  }
  return (
    <div className={`box request-box${compact ? " compact" : ""}`}>
      <b>{compact ? "이 술을 추가해 달라고 요청하기" : "찾는 술이 없나요? 추가를 요청해 주세요"}</b>
      <p className="small muted" style={{ margin: "4px 0 10px" }}>이름과, 알면 양조장이나 어디서 봤는지를 적어 주세요. 확인해서 카탈로그에 넣습니다{ready && !loggedIn ? " — 로그인하면 등록 소식을 마이페이지에서 볼 수 있어요" : ""}.</p>
      <div className="request-fields">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={DRINK_REQUEST_QUERY_MAX} placeholder="술 이름" aria-label="술 이름" />
        <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={DRINK_REQUEST_MEMO_MAX} placeholder="양조장·어디서 봤는지 (선택)" aria-label="메모" />
        <button type="button" className="btn p" disabled={busy || name.trim().length < 2} onClick={submit}>{busy ? "보내는 중…" : "추가 요청"}</button>
      </div>
      {err && <p className="small form-error" role="alert" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}
