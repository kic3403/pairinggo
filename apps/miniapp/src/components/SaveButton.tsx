import { isSaved, savedStore, toggleSaved, toast, type SavedItem } from "@/lib/prefs";
import { track } from "@/lib/analytics";

/** ♡ 저장 토글 — 술 / 음식 / 페어링 조합 / 식당 공용 */
export default function SaveButton({ item, label, size, className }: { item: SavedItem; label?: string; size?: "lg"; className?: string }) {
  const list = savedStore.use();
  const on = isSaved(list, item);
  return (
    <button
      type="button"
      className={`hbtn ${on ? "on" : ""} ${size === "lg" ? "lg" : ""} ${className || ""}`}
      aria-label={on ? "저장 해제" : "저장"} aria-pressed={on}
      onClick={(e) => {
        e.preventDefault(); e.stopPropagation();
        const now = toggleSaved(item);
        track("save", { kind: item.k, on: now });
        toast(now ? "저장했어요 · 저장 탭에서 볼 수 있어요" : "저장을 해제했어요");
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.8-9.5-9C.9 8.6 2.9 5 6.5 5c2.2 0 3.7 1.2 5.5 3 1.8-1.8 3.3-3 5.5-3 3.6 0 5.6 3.6 4 7-2 4.2-9.5 9-9.5 9z" /></svg>
      {label && <span>{label}</span>}
    </button>
  );
}
