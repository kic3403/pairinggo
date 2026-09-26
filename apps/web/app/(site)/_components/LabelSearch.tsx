"use client";
/**
 * 라벨 사진으로 찾기(docs/25 §5, 비비노의 라벨 스캔에 해당) — 사진을 고르면 브라우저에서 긴 변 1,280px JPEG로 줄여 /api/v1/label-read로 보내고,
 * 읽은 이름으로 카탈로그에서 찾은 술을 보여 준다. 못 찾으면 읽은 이름이 채워진 추가 요청 폼. 사진은 서버에 저장하지 않는다.
 */
import Link from "next/link";
import { useRef, useState } from "react";
import { shrinkToJpeg } from "@pairinggo/shared/image-client";
import DrinkRequestForm from "./DrinkRequestForm";
import { track } from "@/lib/track";

type Match = { id: string; name: string; meta: string; href: string; exact: boolean };
type Result = { read: { names: string[]; brewery: string | null; abv: number | null; kind: string | null; note: string }; matches: Match[]; query: string };
const EDGE = 1280;

export default function LabelSearch({ inline = false }: { inline?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) { setErr("사진 파일만 읽을 수 있어요."); return; }
    setBusy(true); setErr(null); setRes(null);
    try {
      const img = await shrinkToJpeg(f, EDGE);
      const r = await fetch("/api/v1/label-read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: [img] }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "사진을 읽지 못했어요");
      setRes(j as Result);
      track("label_read", { q: (j as Result).query, hits: (j as Result).matches.length });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }

  const readLine = res ? [res.read.brewery, res.read.kind, res.read.abv != null ? `${res.read.abv}%` : null].filter(Boolean).join(" · ") : "";
  return (
    <div className={`label-search${inline ? " inline" : ""}`}>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.target.files)} />
      <button type="button" className={`btn${inline ? " xs" : ""} label-btn`} disabled={busy} onClick={() => input.current?.click()} aria-busy={busy}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        {busy ? "라벨 읽는 중…" : "라벨 사진으로 찾기"}
      </button>
      {!inline && !res && !err && <p className="small muted label-hint">병 라벨을 찍거나 사진을 고르면 이름을 읽어 찾아요. 사진은 저장하지 않아요.</p>}
      {err && <p className="small form-error" role="alert" style={{ marginTop: 8 }}>{err}</p>}
      {res && (
        <div className="box label-result" role="status">
          {res.query ? <p className="small muted" style={{ margin: "0 0 8px" }}>라벨에서 읽은 이름 <b>{res.read.names.join(" / ") || res.query}</b>{readLine && <> · {readLine}</>}</p>
            : <p className="small muted" style={{ margin: "0 0 8px" }}>{res.read.note || "라벨에서 제품 이름을 읽지 못했어요. 라벨이 잘 보이게 다시 찍어 주세요."}</p>}
          {res.matches.length > 0 ? (
            <ul className="rows">
              {res.matches.map((m) => (
                <li key={m.id} className="row d">
                  <span className="badge d">술</span>
                  <Link href={m.href} className="grow"><b>{m.name}</b><span className="small muted">{m.meta}</span></Link>
                  {m.exact && <span className="small muted">라벨과 같은 제품</span>}
                </li>
              ))}
            </ul>
          ) : res.query ? (
            <DrinkRequestForm query={res.query} source="label" compact />
          ) : null}
        </div>
      )}
    </div>
  );
}
