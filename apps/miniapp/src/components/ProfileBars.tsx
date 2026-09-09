import { PROFILE_META, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";

/** 맛 프로필 척도(1~5) 표시 — 음식 상세용. 술 상세는 ProfileRadar */
export default function ProfileBars({ kind, profile }: { kind: "drink" | "food"; profile: DrinkProfile | FoodProfile }) {
  const keys = (kind === "drink" ? PROFILE_META.drink_keys : PROFILE_META.food_keys) as Record<string, string>;
  const pr = profile as unknown as Record<string, number>;
  return (
    <div className="mt-3">
      <div className="text-[10.5px] font-bold tracking-widest text-muted">맛 프로필 <span className="font-medium tracking-normal ml-1">1~5 척도 · 페어링 점수 계산에 사용</span></div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1.5">
        {Object.entries(keys).map(([k, label]) => (
          <div key={k} className="flex items-center justify-between text-[12px]">
            <span className="text-ink2">{label}</span>
            <span className={`text-[10px] tracking-[2px] ${kind === "drink" ? "text-drink" : "text-food"}`} aria-label={`${label} ${pr[k] || 0}점`}>{"●".repeat(pr[k] || 0)}{"○".repeat(5 - (pr[k] || 0))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
