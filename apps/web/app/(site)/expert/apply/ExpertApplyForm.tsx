"use client";
/**
 * 전문가 신청 폼 — 실명(공개/비공개 선택, 비공개면 닉네임)·직함(여러 개 + 직접 입력)·소속·소개·증빙 사진(≤3)·공개 동의.
 * 표시명은 적는 대로 미리 보여 준다(shared expertDisplayName). 2026-09-28 사용자 결정: 실명 공개 선택, 직함 복수·직접 입력.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EXPERT_DOCS_MAX, EXPERT_DOC_MAX_BYTES, EXPERT_INTRO_MAX, EXPERT_PEN_MAX, EXPERT_TITLES, EXPERT_TITLES_MAX, cleanTitles, expertApplicationProblem, expertDisplayName } from "@pairinggo/shared/expert";
import { MEMBER_IMAGE_TYPES } from "@pairinggo/shared/member";
import { shrinkToJpegFile } from "@pairinggo/shared/image-client";

/** 파일 크기 표시 — 0.8MB · 340KB */
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

type Defaults = { realName: string; affiliation: string; titles: string[]; intro: string; namePublic: boolean; penName: string } | null;
const PRESET = EXPERT_TITLES as readonly string[];

export default function ExpertApplyForm({ defaults, nick }: { defaults: Defaults; nick: string }) {
  const router = useRouter();
  const [realName, setRealName] = useState(defaults?.realName ?? "");
  const [namePrivate, setNamePrivate] = useState(defaults ? !defaults.namePublic : false);
  const [penName, setPenName] = useState(defaults?.penName || nick || "");
  const [affiliation, setAffiliation] = useState(defaults?.affiliation ?? "");
  const [picked, setPicked] = useState<string[]>((defaults?.titles ?? []).filter((t) => PRESET.includes(t)));
  // 직접 입력 직함 — 한 칸에 적고 [추가]로 하나씩 늘린다(2026-09-29 사용자 요청: 목록에 없는 직함 여러 개)
  const [customList, setCustomList] = useState<string[]>((defaults?.titles ?? []).filter((t) => !PRESET.includes(t)));
  const [draft, setDraft] = useState("");
  const [intro, setIntro] = useState(defaults?.intro ?? "");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 적어 두고 [추가]를 안 눌러도 빠지지 않게 입력 중인 글자도 함께 센다
  const titles = useMemo(() => cleanTitles([...picked, ...customList, ...draft.split(/[,·]/)]), [picked, customList, draft]);
  const addCustom = () => {
    const add = cleanTitles(draft.split(/[,·]/)).filter((t) => !picked.includes(t) && !customList.includes(t));
    const room = EXPERT_TITLES_MAX - cleanTitles([...picked, ...customList]).length;
    if (add.length) setCustomList((l) => [...l, ...add.slice(0, Math.max(0, room))]);
    setDraft("");
  };
  const preview = useMemo(() => expertDisplayName({ realName, affiliation, titles, namePublic: !namePrivate, penName }), [realName, affiliation, titles, namePrivate, penName]);
  const toggleTitle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : titles.length >= EXPERT_TITLES_MAX ? p : [...p, t]));

  // 증빙 사진 — 여러 번 골라도 쌓인다(2026-09-29 사용자 요청: 5장까지·한 번에 여러 장·목록 보기·한 장 5MB)
  function pick(list: FileList | null) {
    const got = Array.from(list ?? []);
    const okType = (f: File) => (MEMBER_IMAGE_TYPES as readonly string[]).includes(f.type);
    const bad = got.filter((f) => !okType(f) || f.size > EXPERT_DOC_MAX_BYTES);
    const fresh = got.filter((f) => okType(f) && f.size <= EXPERT_DOC_MAX_BYTES && !files.some((x) => x.name === f.name && x.size === f.size));
    const room = EXPERT_DOCS_MAX - files.length;
    const add = fresh.slice(0, Math.max(0, room));
    const notes: string[] = [];
    if (bad.length) notes.push(`${bad.map((f) => f.name).join(", ")} — JPG·PNG·WebP 5MB 이하 사진만 올릴 수 있어요`);
    if (fresh.length > add.length) notes.push(`증빙 사진은 ${EXPERT_DOCS_MAX}장까지예요 — ${fresh.length - add.length}장은 빠졌어요`);
    setError(notes.length ? notes.join(" · ") : null);
    if (add.length) setFiles((fs) => [...fs, ...add]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = expertApplicationProblem({ realName, affiliation, titles, intro, namePublic: !namePrivate, penName, docsCount: files.length, publicConsent: consent });
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("realName", realName); fd.set("affiliation", affiliation); fd.set("intro", intro);
    for (const t of titles) fd.append("titles", t);
    if (namePrivate) { fd.set("namePrivate", "on"); fd.set("penName", penName); }
    if (consent) fd.set("publicConsent", "on");
    // 긴 변 1,600px JPEG로 줄여 보낸다 — 5장이어도 서버 본문 한도(4.5MB) 안쪽
    try { for (const f of await Promise.all(files.map((f) => shrinkToJpegFile(f, 1600)))) fd.append("doc", f); }
    catch { setError("사진을 읽지 못했어요 — 다른 사진으로 바꿔 주세요"); setBusy(false); return; }
    const r = await fetch("/api/expert/apply", { method: "POST", body: fd }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setError(j?.error ?? "요청하지 못했어요 — 잠시 뒤 다시 시도해 주세요"); setBusy(false); return; }
    router.refresh();
  }

  const inputStyle = { width: "100%", minHeight: 46, padding: "0 13px", border: "1.5px solid var(--line)", borderRadius: 11, font: "inherit", background: "var(--surface)" } as const;
  return (
    <form onSubmit={submit} style={{ marginTop: 18 }}>
      <label className="field"><span>실명 <span className="muted" style={{ fontWeight: 400 }}>자격 확인용 · 아래에서 비공개를 고르면 카드에는 안 보여요</span></span><input value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={20} placeholder="예: 홍길동" autoComplete="name" required /></label>
      <label className="consent-row" style={{ alignItems: "flex-start", margin: "-4px 0 10px" }}>
        <input type="checkbox" checked={namePrivate} onChange={(e) => setNamePrivate(e.target.checked)} style={{ marginTop: 3 }} />
        <span>실명은 <b>비공개</b>로 할게요 — 카드에는 닉네임으로 보여 주세요</span>
      </label>
      {namePrivate && <label className="field"><span>카드에 보일 닉네임 <span className="muted" style={{ fontWeight: 400 }}>2~{EXPERT_PEN_MAX}자</span></span><input value={penName} onChange={(e) => setPenName(e.target.value)} maxLength={EXPERT_PEN_MAX} placeholder="예: 막걸리요정" /></label>}

      <div className="field">
        <span>직함 <span className="muted" style={{ fontWeight: 400 }}>여러 개 가능 · {EXPERT_TITLES_MAX}개까지</span></span>
        <div className="row" style={{ gap: 6, flexWrap: "wrap", border: 0, padding: 0 }}>
          {EXPERT_TITLES.map((t) => <button key={t} type="button" className={`btn sm${picked.includes(t) ? " p" : ""}`} aria-pressed={picked.includes(t)} onClick={() => toggleTitle(t)}>{t}</button>)}
        </div>
        {customList.length > 0 && (
          <div className="row" style={{ gap: 6, flexWrap: "wrap", border: 0, padding: 0, marginTop: 8 }}>
            {customList.map((t) => (
              <button key={t} type="button" className="btn sm p" onClick={() => setCustomList((l) => l.filter((x) => x !== t))} aria-label={`${t} 빼기`} title="누르면 빠져요">{t}&nbsp;×</button>
            ))}
          </div>
        )}
        <div className="row" style={{ gap: 6, flexWrap: "nowrap", border: 0, padding: 0, marginTop: 8 }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={40} placeholder="목록에 없으면 직접 입력 — 예: 주류 MD"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); addCustom(); } }} style={{ ...inputStyle, flex: 1 }} />
          <button type="button" className="btn" style={{ minHeight: 46, whiteSpace: "nowrap" }} onClick={addCustom}
            disabled={!draft.trim() || cleanTitles([...picked, ...customList]).length >= EXPERT_TITLES_MAX}>+ 추가</button>
        </div>
        <p className="muted small" style={{ margin: "4px 0 0" }}>하나 적고 [+ 추가] — 여러 개 넣을 수 있어요. 넣은 직함을 누르면 빠져요.</p>
      </div>
      <label className="field"><span>소속 <span className="muted" style={{ fontWeight: 400 }}>선택 · 회사·매장·단체. 있으면 직함 대신 이름 옆에 보여요</span></span><input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} maxLength={40} placeholder="예: ○○레스토랑, ○○양조장" /></label>
      <label className="field"><span>짧은 소개 <span className="muted" style={{ fontWeight: 400 }}>선택 · {EXPERT_INTRO_MAX}자 · 공개</span></span><textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={EXPERT_INTRO_MAX} rows={3} placeholder="예: 전통주 소믈리에 자격 보유, 한식 페어링 클래스 운영 5년" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)", borderRadius: 11, font: "inherit", resize: "vertical" }} /></label>
      <div className="field">
        <span>자격증 사진 <span className="muted" style={{ fontWeight: 400 }}>필수 · {EXPERT_DOCS_MAX}장까지 · 한 장 5MB 이하 · 자격증·명함·재직 확인 등 · 운영자만 봐요</span></span>
        <label className="btn sm" style={{ display: "inline-flex", cursor: files.length >= EXPERT_DOCS_MAX ? "default" : "pointer", opacity: files.length >= EXPERT_DOCS_MAX ? 0.5 : 1 }}>
          + 사진 추가 ({files.length}/{EXPERT_DOCS_MAX})
          <input type="file" accept={(MEMBER_IMAGE_TYPES as readonly string[]).join(",")} multiple disabled={files.length >= EXPERT_DOCS_MAX}
            onChange={(e) => { pick(e.target.files); e.target.value = ""; }} style={{ display: "none" }} />
        </label>
        <p className="muted small" style={{ margin: "4px 0 0" }}>여러 장을 한꺼번에 골라도 되고, 여러 번 나눠 추가해도 돼요.</p>
        {files.length > 0 && (
          <ul className="xdocs" aria-label="첨부한 사진">
            {files.map((f, i) => (
              <li key={`${f.name}-${f.size}-${i}`}>
                <b>{i + 1}.</b> <em>{f.name}</em> <small className="muted">{fmtSize(f.size)}</small>
                <button type="button" className="btn sm" onClick={() => setFiles((fs) => fs.filter((_, j) => j !== i))} aria-label={`${f.name} 빼기`}>빼기</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="small" style={{ margin: "4px 0 12px", padding: "10px 12px", background: "var(--bg2)", borderRadius: 10 }}>카드 표시명 미리보기: <b>{preview || (namePrivate ? "닉네임을 적으면 보여요" : "실명을 적으면 보여요")}</b></p>
      <label className="consent-row" style={{ alignItems: "flex-start", marginBottom: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span><em style={{ fontStyle: "normal", color: "var(--food-ink)", fontWeight: 600 }}>[필수]</em> {namePrivate ? "닉네임" : "실명"}과 소속(소속이 없으면 직함), 소개, 판정과 한 줄 이유를 페어링 카드와 전문가 화면에 공개하는 데 동의합니다. {namePrivate ? "실명은 운영자만 자격 확인에 보고 공개하지 않습니다. " : ""}증빙 사진과 연락처는 공개하지 않습니다.</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn p" style={{ width: "100%" }} disabled={busy}>{busy ? "보내는 중…" : "전문가 등급 요청하기"}</button>
    </form>
  );
}
