"use client";
/** 전문가 신청 폼 — 실명·소속·직함·소개·증빙 사진(≤3) + 실명·소속 공개 동의. 표시명은 적는 대로 미리 보여 준다(shared expertDisplayName) */
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { EXPERT_DOCS_MAX, EXPERT_INTRO_MAX, EXPERT_TITLES, expertApplicationProblem, expertDisplayName } from "@pairinggo/shared/expert";
import { MEMBER_IMAGE_MAX_BYTES, MEMBER_IMAGE_TYPES } from "@pairinggo/shared/member";

type Defaults = { realName: string; affiliation: string; title: string; intro: string } | null;

export default function ExpertApplyForm({ defaults }: { defaults: Defaults }) {
  const router = useRouter();
  const [realName, setRealName] = useState(defaults?.realName ?? "");
  const [affiliation, setAffiliation] = useState(defaults?.affiliation ?? "");
  const preset = (EXPERT_TITLES as readonly string[]).includes(defaults?.title ?? "") ? defaults!.title : defaults?.title ? "기타" : "소믈리에";
  const [title, setTitle] = useState(preset);
  const [titleCustom, setTitleCustom] = useState(preset === "기타" ? defaults?.title ?? "" : "");
  const [intro, setIntro] = useState(defaults?.intro ?? "");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalTitle = title === "기타" ? titleCustom.trim() || "기타" : title;
  const preview = useMemo(() => expertDisplayName(realName, affiliation, finalTitle), [realName, affiliation, finalTitle]);

  function pick(list: FileList | null) {
    const arr = Array.from(list ?? []).slice(0, EXPERT_DOCS_MAX);
    const bad = arr.find((f) => !(MEMBER_IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > MEMBER_IMAGE_MAX_BYTES);
    if (bad) { setError("증빙은 JPG·PNG·WebP 3MB 이하 사진만 올릴 수 있어요"); return; }
    setError(null); setFiles(arr);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = expertApplicationProblem({ realName, affiliation, title: finalTitle, intro, docsCount: files.length, publicConsent: consent });
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("realName", realName); fd.set("affiliation", affiliation); fd.set("title", finalTitle); fd.set("intro", intro);
    if (consent) fd.set("publicConsent", "on");
    for (const f of files) fd.append("doc", f);
    const r = await fetch("/api/expert/apply", { method: "POST", body: fd }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!r?.ok) { setError(j?.error ?? "신청하지 못했어요 — 잠시 뒤 다시 시도해 주세요"); setBusy(false); return; }
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 18 }}>
      <label className="field"><span>실명 <span className="muted" style={{ fontWeight: 400 }}>카드에 공개돼요</span></span><input value={realName} onChange={(e) => setRealName(e.target.value)} maxLength={20} placeholder="예: 홍길동" autoComplete="name" required /></label>
      <label className="field"><span>직함</span>
        <select value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", minHeight: 46, padding: "0 13px", border: "1.5px solid var(--line)", borderRadius: 11, font: "inherit", background: "var(--surface)" }}>
          {EXPERT_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {title === "기타" && <label className="field"><span>직함 직접 입력</span><input value={titleCustom} onChange={(e) => setTitleCustom(e.target.value)} maxLength={20} placeholder="예: 주류 MD" /></label>}
      <label className="field"><span>소속 <span className="muted" style={{ fontWeight: 400 }}>선택 · 회사·매장·단체. 있으면 직함 대신 이름 옆에 보여요</span></span><input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} maxLength={40} placeholder="예: ○○레스토랑, ○○양조장" /></label>
      <label className="field"><span>짧은 소개 <span className="muted" style={{ fontWeight: 400 }}>선택 · {EXPERT_INTRO_MAX}자 · 공개</span></span><textarea value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={EXPERT_INTRO_MAX} rows={3} placeholder="예: 전통주 소믈리에 자격 보유, 한식 페어링 클래스 운영 5년" style={{ width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)", borderRadius: 11, font: "inherit", resize: "vertical" }} /></label>
      <label className="field"><span>자격 증빙 사진 <span className="muted" style={{ fontWeight: 400 }}>선택 · {EXPERT_DOCS_MAX}장까지 · 자격증·명함·재직 확인 등 · 운영자만 봐요</span></span>
        <input type="file" accept={(MEMBER_IMAGE_TYPES as readonly string[]).join(",")} multiple onChange={(e) => pick(e.target.files)} style={{ minHeight: 0, padding: "10px 0", border: 0 }} />
        {files.length > 0 && <span className="field-msg">{files.map((f) => f.name).join(", ")}</span>}
      </label>
      <p className="small" style={{ margin: "4px 0 12px", padding: "10px 12px", background: "var(--bg2)", borderRadius: 10 }}>카드 표시명 미리보기: <b>{preview || "실명을 적으면 보여요"}</b></p>
      <label className="consent-row" style={{ alignItems: "flex-start", marginBottom: 12 }}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
        <span><em style={{ fontStyle: "normal", color: "var(--food-ink)", fontWeight: 600 }}>[필수]</em> 실명과 소속(소속이 없으면 직함), 소개, 판정과 한 줄 이유를 페어링 카드와 전문가 화면에 공개하는 데 동의합니다. 증빙 사진과 연락처는 공개하지 않습니다.</span>
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" className="btn p" style={{ width: "100%" }} disabled={busy}>{busy ? "보내는 중…" : "신청하기"}</button>
    </form>
  );
}
