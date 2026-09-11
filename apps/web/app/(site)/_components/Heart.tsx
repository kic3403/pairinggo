"use client";
/** 하트(찜) 버튼 — 전통주·음식·음식점 공통. 비로그인이면 로그인으로 보낸다. */
import { useRouter } from "next/navigation";
import { useSaved, type PlaceMeta, type SavedKind } from "./SavedProvider";

export default function Heart({ kind, id, name, meta, variant = "icon" }: {
  kind: SavedKind; id: string; name: string; meta?: PlaceMeta; variant?: "icon" | "button";
}) {
  const { ready, loggedIn, has, toggle } = useSaved();
  const router = useRouter();
  const on = has(kind, id);

  const click = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!loggedIn) { router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`); return; }
    void toggle(kind, id, meta);
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
