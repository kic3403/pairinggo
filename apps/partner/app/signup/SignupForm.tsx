"use client";
import { useRef, useState } from "react";

type Place = { id: string; name: string; category: string; address: string; phone: string | null };

export function SignupForm() {
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [picked, setPicked] = useState<Place | null>(null);
  const [searchErr, setSearchErr] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function search(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 2) { setPlaces(null); return; }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/place-search?q=${encodeURIComponent(v.trim())}`).catch(() => null);
      const j = (await r?.json().catch(() => ({}))) as { places?: Place[]; error?: string } | undefined;
      setSearchErr(j?.error ?? (r ? "" : "검색하지 못했어요"));
      setPlaces(j?.places ?? []);
    }, 300);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!picked) { setErr("매장을 검색해서 골라 주세요"); return; }
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("password2")) { setErr("비밀번호 두 칸이 서로 달라요"); return; }
    setBusy(true); setErr("");
    const body = {
      email: f.get("email"), password: f.get("password"), name: f.get("name"), phone: f.get("phone"),
      kakaoPlaceId: picked.id, placeName: picked.name, ownerName: f.get("ownerName"), bizNo: f.get("bizNo"), agree: f.get("agree") === "on",
    };
    const r = await fetch("/api/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (r?.ok) { location.href = "/"; return; }
    setBusy(false); setErr(j?.error ?? "신청하지 못했어요 — 잠시 뒤 다시 시도해 주세요");
  }

  return (
    <form className="stack" onSubmit={submit}>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>매장</h2>
        {picked ? (
          <div className="picked">
            <div><b>{picked.name}</b><span>{picked.address}{picked.phone ? ` · ${picked.phone}` : ""}</span></div>
            <button type="button" className="btn ghost sm" onClick={() => { setPicked(null); setPlaces(null); setQ(""); }}>다시 찾기</button>
          </div>
        ) : (
          <label className="f">내 매장 찾기 <span className="hint">카카오맵에 나오는 상호로 검색해 주세요(예: 상호 + 동네)</span>
            <input type="text" value={q} onChange={(e) => search(e.target.value)} placeholder="상호 검색" autoComplete="off" />
            {searchErr ? <span className="err">{searchErr}</span> : null}
            {places && places.length > 0 ? (
              <ul className="picks">
                {places.slice(0, 8).map((p) => (
                  <li key={p.id}><button type="button" onClick={() => setPicked(p)}><b>{p.name}</b><span>{[p.category, p.address].filter(Boolean).join(" · ")}</span></button></li>
                ))}
              </ul>
            ) : places ? <span className="hint">검색 결과가 없어요 — 상호를 조금 다르게 적어 보세요</span> : null}
          </label>
        )}
        <label className="f">대표자 이름<input type="text" name="ownerName" required maxLength={20} /></label>
        <label className="f">사업자등록번호 <span className="hint">숫자 10자리 — 승인할 때 운영자가 확인해요</span><input type="text" name="bizNo" inputMode="numeric" required placeholder="000-00-00000" maxLength={12} /></label>
      </section>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>로그인 계정</h2>
        <label className="f">담당자 이름<input type="text" name="name" required maxLength={20} autoComplete="name" /></label>
        <label className="f">담당자 휴대폰 <span className="hint">예약 알림(알림톡)을 받을 번호</span><input type="tel" name="phone" required inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" /></label>
        <label className="f">이메일<input type="email" name="email" required autoComplete="username" /></label>
        <label className="f">비밀번호 <span className="hint">8자 이상, 숫자만으로는 안 돼요</span><input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
        <label className="f">비밀번호 확인<input type="password" name="password2" required minLength={8} autoComplete="new-password" /></label>
        <label className="check"><input type="checkbox" name="agree" required /><span><a href="/terms" target="_blank" rel="noreferrer">파트너 이용약관과 개인정보 수집·이용</a>에 동의합니다.</span></label>
      </section>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn primary block" disabled={busy}>{busy ? "신청하는 중…" : "가입 신청"}</button>
    </form>
  );
}
