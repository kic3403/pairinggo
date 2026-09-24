/**
 * 맛 프로필 그래프 — 페어링 카드 안에 들어가는 작은 세로 막대(2026-09-24 사용자 요청).
 * "무게 4 · 기름기 4 · …" 글줄 대신 한눈에 높낮이가 보이게 한다.
 * 축·순서는 상세 화면의 가로 막대(ProfileBars)와 같다(shared pairing/summary.ts profileAxes).
 */
import { profileAxes, profileLine, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";

export default function ProfileChart({ kind, profile }: { kind: "drink" | "food"; profile?: DrinkProfile | FoodProfile }) {
  const axes = profileAxes(kind, profile);
  if (!axes.length) return null;
  // 화면을 읽어 주는 기기에는 예전처럼 한 줄로 들려준다(같은 규칙 profileLine)
  const label = kind === "drink" ? profileLine("drink", profile as DrinkProfile) : profileLine("food", profile as FoodProfile);
  return (
    <div className="pchart" role="img" aria-label={`맛 프로필 ${label ?? ""}`}>
      {axes.map((a) => (
        <div key={a.key} className="pc-col" title={`${a.label} ${a.value}/5`}>
          <div className="pc-bar" aria-hidden><span style={{ height: `${(a.value / 5) * 100}%` }} /></div>
          <b aria-hidden>{a.value}</b>
          <span className="pc-label" aria-hidden>{a.label}</span>
        </div>
      ))}
    </div>
  );
}
