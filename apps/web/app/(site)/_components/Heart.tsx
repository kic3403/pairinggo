"use client";
/** 하트(찜) 버튼 — 전통주·음식·음식점 공통. 비로그인이면 기기에 담고 로그인하면 계정으로 옮긴다(SavedProvider, 2026-10-01). */
import { useSaved, type PlaceMeta, type SavedKind } from "./SavedProvider";

export default function Heart({ kind, id, name, meta, variant = "icon" }: {
  kind: SavedKind; id: string; name: string; meta?: PlaceMeta; variant?: "icon" | "button";
}) {
  const { ready, has, toggle } = useSaved();
  const on = has(kind, id);

  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    void toggle(kind, id, meta, name);
  };

  const label = `${name} ${on ? "저장 해제" : "저장"}`;
  if (variant === "button") {
    return (
      <button className={`btn heart-btn${on ? " on" : ""}`} onClick={click} aria-pressed={on} aria-label={label} disabled={!ready}>
        <span aria-hidden>{on ? "♥" : "♡"}</span> {on ? "저장됨" : "저장"}
      </button>
    );
  }
  return (
    <button className={`heart${on ? " on" : ""}`} onClick={click} aria-pressed={on} aria-label={label} title={label} disabled={!ready}>
      <span aria-hidden>{on ? "♥" : "♡"}</span>
    </button>
  );
}
