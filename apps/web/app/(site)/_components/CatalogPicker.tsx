"use client";
/** 카탈로그에서 술·음식 하나 고르기(검색 → 후보 칩) — 회원 추천(MemberPickCompose)과 전문가 검수 제안(ExpertReview)이 함께 쓴다 */
import { useMemo } from "react";

export type Opt = { id: string; name: string };

export default function CatalogPicker({ label, placeholder, options, value, onChange, allowUnknown = true }: { label: string; placeholder: string; options: Opt[]; value: { q: string; picked: Opt | null }; onChange: (v: { q: string; picked: Opt | null }) => void; allowUnknown?: boolean }) {
  const matches = useMemo(() => {
    const s = value.q.trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return [];
    return options.filter((o) => o.name.toLowerCase().replace(/\s+/g, "").includes(s)).slice(0, 6);
  }, [value.q, options]);
  const exact = matches.find((o) => o.name.replace(/\s+/g, "") === value.q.trim().replace(/\s+/g, ""));
  const chosen = value.picked ?? exact ?? null;
  return (
    <>
      <label className="mp-field">
        <span>{label}{chosen && <em className="mp-chosen"> ✓ {chosen.name}</em>}</span>
        <input value={value.q} onChange={(e) => onChange({ q: e.target.value, picked: null })} placeholder={placeholder} autoComplete="off" />
      </label>
      {!chosen && matches.length > 0 && (
        <ul className="mp-sugg" role="listbox">
          {matches.map((o) => <li key={o.id}><button type="button" onClick={() => onChange({ q: o.name, picked: o })}>{o.name}</button></li>)}
        </ul>
      )}
      {!chosen && value.q.trim() && matches.length === 0 && <p className="small muted" style={{ margin: "-2px 0 8px" }}>{"목록에 없는 이름이에요."}{" "}{allowUnknown ? "그대로 보내면 확인한 뒤 게시돼요." : "카탈로그에 있는 이름을 골라 주세요."}</p>}
    </>
  );
}

