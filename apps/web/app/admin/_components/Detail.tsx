/**
 * 어드민 신청 상세(2026-09-29 사용자 요청 — 파트너·전문가 신청 내용을 전부 보이게) — 항목 표와 서류 사진.
 * 서류 사진은 비공개 저장소의 10분짜리 서명 주소라 새로고침하면 다시 만든다.
 */
import type { ReactNode } from "react";

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  const shown = rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  return (
    <dl className="kv">
      {shown.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

export function DocThumbs({ label, urls, missing }: { label: string; urls: (string | null)[]; missing: string }) {
  return (
    <div className="docs">
      <b>{label}</b>
      {urls.length === 0 ? <span className="tag w" style={{ marginLeft: 6 }}>{missing}</span> : (
        <div className="doc-row">
          {urls.map((u, i) => u
            ? <a key={i} href={u} target="_blank" rel="noreferrer" title="크게 보기(10분 뒤 만료 — 새로고침하면 다시 열려요)"><img src={u} alt={`${label} ${i + 1}`} /></a>
            : <span key={i} className="tag m">사진을 열 수 없어요</span>)}
        </div>
      )}
    </div>
  );
}

export const fmtTime = (s: string | null | undefined) => (s ? new Date(s).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" }) : "");
