"use client";
/**
 * 전문가 신청 폼 — 실명(공개/비공개 선택, 비공개면 닉네임)·직함(여러 개 + 직접 입력)·소속·소개·증빙 사진(≤3)·공개 동의.
 * 표시명은 적는 대로 미리 보여 준다(shared expertDisplayName). 2026-09-28 사용자 결정: 실명 공개 선택, 직함 복수·직접 입력.
 */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EXPERT_DOCS_MAX, EXPERT_INTRO_MAX, EXPERT_PEN_MAX, EXPERT_TITLES, EXPERT_TITLES_MAX, cleanTitles, expertApplicationProblem, expertDisplayName } from "@pairinggo/shared/expert";
import { MEMBER_IMAGE_MAX_BYTES, MEMBER_IMAGE_TYPES } from "@pairinggo/shared/member";

type Defaults = { realName: string; affiliation: string; titles: string[]; intro: string; namePublic: boolean; penName: string } | null;
const PRESET = EXPERT_TITLES as readonly string[];

export default function ExpertApplyForm({ defaults, nick }: { defaults: Defaults; nick: string }) {
  const router = useRouter();
  const [realName, setRealName] = useState(defaults?.realName ?? "");
  const [namePrivate, setNamePrivate] = useState(defaults ? !defaults.namePublic : false);
  const [penName, setPenName] = useState(defaults?.penName || nick || "");
  const [affiliation, setAffiliation] = useState(defaults?.affiliation ?? "");
  const [picked, setPicked] = useState<string[]>((defaults?.titles ?? []).filter((t) => PRESET.includes(t)));
  const [custom, setCustom] = useState((defaults?.titles ?? []).filter((t) => !PRESET.includes(t)).join(", "));
  const [intro, setIntro] = useState(defaults?.intro ?? "");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titles = useMemo(() => cleanTitles([...picked, ...custom.split(/[,·]/)]), [picked, custom]);
  const preview = useMemo(() => expertDisplayName({ realName, affiliation, titles, namePublic: !namePrivate, penName }), [realName, affiliation, titles, namePrivate, penName]);
  const toggleTitle = (t: string) => setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : titles.length >= EXPERT_TITLES_MAX ? p : [...p, t]));

  function pick(list: FileList | null) {
    const arr = Array.from(list ?? []).slice(0, EXPERT_DOCS_MAX);
    const bad = arr.find((f) => !(MEMBER_IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > MEMBER_IMAGE_MAX_BYTES);
    if (bad) { setError("증빙은 JPG·PNG·WebP 3MB 이하 사진만 올릴 수 있어요"); return; }
    setError(null); setFiles(arr);
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
    for (const f of files) fd.append("doc", f);
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
        <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={60} placeholder="직접 입력 — 예: 주류 MD, 전통주 강사 (쉼표로 여러 개)" style={{ ...inputStyle, marginTop: 8 }} />
      </div>
      <label className="field"><span>소속 <span className="muted" style={{ fontWeight: 400 }}>선택 · 회사·매장·단체. 있으면 직함 대신 이름 옆에 보여요</span></span><input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} maxLength={40} placeholder="예: ○○레스토랑, ○○양조장" /></label>
      <label className="field"><span>짧은 소개 <span className="muted" style={{ fontWeight: 400 }}>선택 · {EXPERT_INTRO_MAX}자 · 공개</span></span><textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={EXPERT_INTRO_MAX} rows={3} placeholder="예: 전통주 소믈리에 자격 보유, 한식 페어링 클래스 운영 5년" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)", borderRadius: 11, font: "inherit", resize: "vertical" }} /></label>
      <label className="field"><span>자격증 사진 <span className="muted" style={{ fontWeight: 400 }}>필수 · {EXPERT_DOCS_MAX}장까지 · 자격증·명함·재직 확인 등 · 운영자만 봐요</span></span>
        <input type="file" accept={(MEMBER_IMAGE_TYPES as readonly string[]).join(",")} multiple required onChange={(e) => pick(e.target.files)} style={{ minHeight: 0, padding: "10px 0", border: 0 }} />
        {files.length > 0 && <span className="field-msg">{files.map((f) => f.name).join(", ")}</span>}
      </label>
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
