import { useState } from "react";
import { isSaved, savedStore, toggleSaved, toast, useRegion } from "@/lib/prefs";

/** 음식 상세: 가고 싶은 식당을 메모처럼 저장 (저장 탭 › 식당) — Phase 3 앱 내 식당 리스트 전까지의 대체 */
export default function PlaceMemo({ food }: { food: string }) {
  const [name, setName] = useState("");
  const { st, cur } = useRegion();
  const add = () => {
    const n = name.trim();
    if (!n) { toast("식당 이름을 입력해 주세요"); return; }
    const item = { k: "place" as const, name: n, food, region: st.gps ? "" : cur.id === "all" ? "" : cur.label };
    if (isSaved(savedStore.read(), item)) { toast("이미 저장된 식당이에요"); return; }
    toggleSaved(item); toast("식당을 저장했어요 · 저장 탭 › 식당"); setName("");
  };
  return (
    <div className="flex gap-1.5 mt-3">
      <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
        placeholder={`가고 싶은 ${food} 식당 이름 메모`} className="flex-1 min-w-0 bg-transparent border-b border-line focus:border-ink outline-none py-1.5 text-[13.5px]" />
      <button onClick={add} className="text-[12.5px] font-bold px-3 py-1.5 border border-ink rounded-md">식당 저장</button>
    </div>
  );
}
