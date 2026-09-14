/**
 * 맛 프로필 막대 — 술은 바디·산미·단맛·탄산·향, 음식은 무게·기름기·매운맛·감칠맛·짠맛·단맛을 1~5칸으로(데일리샷 상세의 Tasting Notes 자리, docs/19 §5).
 * 페어링 카드의 "맛 프로필" 줄과 같은 축·순서(shared pairing/summary.ts profileAxes).
 */
import { profileAxes, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";

export default function ProfileBars({ kind, profile }: { kind: "drink" | "food"; profile?: DrinkProfile | FoodProfile }) {
  const axes = profileAxes(kind, profile);
  if (!axes.length) return null;
  return (
    <section className="pbars" aria-label="맛 프로필">
      <h3>맛 프로필 <span className="muted small">1~5</span></h3>
      <dl>
        {axes.map((a) => (
          <div key={a.key}>
            <dt>{a.label}</dt>
            <dd aria-label={`${a.label} ${a.value}점`}>
              {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= a.value ? "on" : undefined} />)}
              <b>{a.value}</b>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
