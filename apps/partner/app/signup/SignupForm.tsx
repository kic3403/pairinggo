"use client";
import { useRef, useState } from "react";

type Place = { id: string; name: string; category: string; address: string; phone: string | null };

/** social: 카카오·네이버로 들어온 가입(비밀번호 없이, 받은 이름·휴대폰·이메일을 미리 채움) */
export type SocialSignup = { provider: "kakao" | "naver"; label: string; name: string | null; phone: string | null; email: string | null };

export function SignupForm({ social }: { social?: SocialSignup | null }) {
  const [q, setQ] = useState("");
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [picked, setPicked] = useState<Place | null>(null);
  // 검색에 안 나오는 매장 — 상호·주소·전화 직접 입력(운영자가 승인할 때 카카오맵 장소를 찾아 연결)
  const [manual, setManual] = useState(false);
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
    if (!picked && !manual) { setErr("매장을 검색해서 고르거나, 검색이 안 되면 직접 입력해 주세요"); return; }
    const f = new FormData(e.currentTarget);
    if (!social && f.get("password") !== f.get("password2")) { setErr("비밀번호 두 칸이 서로 달라요"); return; }
    setBusy(true); setErr("");
    const body = {
      email: f.get("email"), password: social ? "" : f.get("password"), name: f.get("name"), phone: f.get("phone"), social: !!social,
      kakaoPlaceId: manual ? "" : picked!.id, placeName: manual ? "" : picked!.name,
      manualPlace: manual ? { name: f.get("placeName"), address: f.get("placeAddress"), phone: f.get("placePhone") } : null, ownerName: f.get("ownerName"), bizNo: f.get("bizNo"), agree: f.get("agree") === "on",
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
        {manual ? (
          <div className="stack manual-place">
            <p className="hint" style={{ margin: 0 }}>카카오맵 검색에 안 나오는 매장(새로 연 곳 등)은 직접 적어 신청해 주세요. 운영자가 승인할 때 확인해 카카오맵 장소와 연결하고, <b>연결 전까지는 페어링GO 식당 검색·예약에 나오지 않아요.</b> 매장 정보·영업시간은 승인되면 바로 정할 수 있어요.</p>
            <label className="f">매장 상호<input type="text" name="placeName" required minLength={2} maxLength={40} placeholder="예: 페어링 주점 둔산점" /></label>
            <label className="f">매장 주소 <span className="hint">도로명 주소 + 층·호수</span><input type="text" name="placeAddress" required minLength={5} maxLength={120} placeholder="예: 대전 서구 둔산로 100 1층" autoComplete="street-address" /></label>
            <label className="f">매장 전화 <span className="hint">선택</span><input type="tel" name="placePhone" inputMode="tel" maxLength={20} placeholder="042-000-0000" /></label>
            <button type="button" className="linklike" style={{ justifySelf: "start" }} onClick={() => { setManual(false); setErr(""); }}>← 다시 검색하기</button>
          </div>
        ) : picked ? (
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
        {!manual && !picked ? (
          <button type="button" className="linklike to-manual" onClick={() => { setManual(true); setErr(""); }}>
            검색해도 내 매장이 안 나와요 → 직접 입력하기
          </button>
        ) : null}
        <label className="f">대표자 이름<input type="text" name="ownerName" required maxLength={20} /></label>
        <label className="f">사업자등록번호 <span className="hint">숫자 10자리 — 승인할 때 운영자가 확인해요</span><input type="text" name="bizNo" inputMode="numeric" required placeholder="000-00-00000" maxLength={12} /></label>
      </section>
      <section className="panel stack">
        <h2 style={{ margin: 0 }}>로그인 계정</h2>
        {social ? <p className="okmsg" style={{ margin: 0 }}>{social.label} 계정으로 가입해요 — 비밀번호 없이 다음부터 {social.label} 로그인으로 들어와요.</p> : null}
        <label className="f">담당자 이름<input type="text" name="name" required maxLength={20} autoComplete="name" defaultValue={social?.name ?? ""} /></label>
        <label className="f">담당자 휴대폰 <span className="hint">예약 알림(알림톡)·비밀번호 찾기에 쓰는 번호</span><input type="tel" name="phone" required inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" defaultValue={social?.phone ?? ""} /></label>
        <label className="f">이메일 <span className="hint">운영자 연락용</span><input type="email" name="email" required autoComplete="username" defaultValue={social?.email ?? ""} /></label>
        {!social ? (
          <>
            <label className="f">비밀번호 <span className="hint">8자 이상, 숫자만으로는 안 돼요</span><input type="password" name="password" required minLength={8} autoComplete="new-password" /></label>
            <label className="f">비밀번호 확인<input type="password" name="password2" required minLength={8} autoComplete="new-password" /></label>
          </>
        ) : null}
        <label className="check"><input type="checkbox" name="agree" required /><span><a href="/terms" target="_blank" rel="noreferrer">파트너 이용약관과 개인정보 수집·이용</a>에 동의합니다.</span></label>
      </section>
      {err ? <p className="err" role="alert">{err}</p> : null}
      <button className="btn primary block" disabled={busy}>{busy ? "신청하는 중…" : "가입 신청"}</button>
    </form>
  );
}
