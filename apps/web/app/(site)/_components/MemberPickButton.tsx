"use client";
/**
 * "이 술엔 이 음식" 회원 추천 — 버튼을 누르면 작은 폼: 상대(음식 또는 술) 고르기(카탈로그 검색, 없으면 직접 입력 → 검수), 한 줄 글(140자), 사진 1장.
 * 비로그인은 로그인으로. 결과 문구는 packages/shared/src/pairing/member.ts.
 */
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { MEMBER_PICK_NOTE_MAX, validateMemberNote } from "@pairinggo/shared/member";
import { track } from "@/lib/track";
import { useSaved } from "./SavedProvider";

type Opt = { id: string; name: string };

export default function MemberPickButton({ mode, subjectId, subjectName, options }: { mode: "drink" | "food"; subjectId: string; subjectName: string; options: Opt[] }) {
  const { ready, loggedIn } = useSaved();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Opt | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const otherLabel = mode === "drink" ? "음식" : "전통주";

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return [];
    return options.filter((o) => o.name.toLowerCase().replace(/\s+/g, "").includes(s)).slice(0, 6);
  }, [q, options]);
  const exact = matches.find((o) => o.name.replace(/\s+/g, "") === q.trim().replace(/\s+/g, ""));
  const chosen = picked ?? exact ?? null;

  const start = () => {
    if (ready && !loggedIn) { router.push(`/login?next=${encodeURIComponent(pathname + "#recommend")}`); return; }
    setOpen(true); setMsg(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const bad = validateMemberNote(note);
    if (bad) { setMsg({ ok: false, text: bad }); return; }
    if (!chosen && !q.trim()) { setMsg({ ok: false, text: `${otherLabel} 이름을 적어 주세요` }); return; }
    setBusy(true); setMsg(null);
    const fd = new FormData();
    if (mode === "drink") { fd.set("d", subjectId); if (chosen) fd.set("f", chosen.id); else fd.set("food_raw", q.trim()); }
    else { fd.set("f", subjectId); if (chosen) fd.set("d", chosen.id); else fd.set("drink_raw", q.trim()); }
    fd.set("note", note.trim());
    const img = file.current?.files?.[0];
    if (img) fd.set("image", img);
    try {
      const r = await fetch("/api/picks", { method: "POST", body: fd });
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) { router.push(`/login?next=${encodeURIComponent(pathname + "#recommend")}`); return; }
      if (!r.ok) { setMsg({ ok: false, text: j.error || "저장하지 못했어요" }); return; }
      track("member_pick", { d: mode === "drink" ? subjectId : chosen?.id ?? null, f: mode === "food" ? subjectId : chosen?.id ?? null, status: j.status, n: j.n });
      setMsg({ ok: true, text: j.status === "review" ? "고마워요! 카탈로그에 없는 이름이라 확인한 뒤 게시돼요." : j.published ? `고마워요! 글이 올라갔고, 이 조합은 페어링 카드에도 실렸어요.` : `고마워요! 글이 회원 추천에 바로 올라갔어요. 하트를 받으면 위로 올라가요.` });
      setNote(""); setQ(""); setPicked(null); if (file.current) file.current.value = "";
      router.refresh();   // 카드 줄·회원픽 카드가 바로 보이게
    } catch { setMsg({ ok: false, text: "저장하지 못했어요. 잠시 후 다시 눌러 주세요." }); }
    finally { setBusy(false); }
  };

  return (
    <div className="mp" id="recommend">
      {!open ? (
        <button type="button" className="btn mp-open" onClick={start}>🙌 {subjectName}{mode === "drink" ? "에 어울리는 음식" : "에 어울리는 전통주"} 추천하기</button>
      ) : (
        <form className="mp-form" onSubmit={submit}>
          <div className="mp-head"><b>회원 추천</b><span className="small muted">올리면 바로 회원 추천에 보여요. 닉네임만 표시돼요.</span></div>
          <label className="mp-field">
            <span>{otherLabel}</span>
            <input value={chosen ? chosen.name : q} onChange={(e) => { setQ(e.target.value); setPicked(null); }} placeholder={mode === "drink" ? "예: 육회, 감자전" : "예: 복순도가, 화요"} autoComplete="off" />
          </label>
          {!chosen && matches.length > 0 && (
            <ul className="mp-sugg" role="listbox">
              {matches.map((o) => <li key={o.id}><button type="button" onClick={() => { setPicked(o); setQ(o.name); }}>{o.name}</button></li>)}
            </ul>
          )}
          {!chosen && q.trim() && matches.length === 0 && <p className="small muted">목록에 없는 이름이에요. 그대로 보내면 확인한 뒤 게시돼요.</p>}
          <label className="mp-field">
            <span>한 줄 이유 <em className="muted">({note.length}/{MEMBER_PICK_NOTE_MAX})</em></span>
            <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, MEMBER_PICK_NOTE_MAX))} rows={2} placeholder="어디서 어떻게 먹었는지, 왜 잘 맞았는지 (선택)" />
          </label>
          <label className="mp-field">
            <span>사진 1장 <em className="muted">(선택, 3MB까지)</em></span>
            <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" />
          </label>
          <div className="btns" style={{ marginTop: 6 }}>
            <button type="submit" className="btn p" disabled={busy}>{busy ? "보내는 중…" : "추천 보내기"}</button>
            <button type="button" className="btn" onClick={() => setOpen(false)} disabled={busy}>닫기</button>
          </div>
          {msg && <p className={`small ${msg.ok ? "mp-ok" : "form-error"}`} aria-live="polite">{msg.text}</p>}
        </form>
      )}
      {!open && msg?.ok && <p className="small mp-ok" aria-live="polite">{msg.text}</p>}
    </div>
  );
}
