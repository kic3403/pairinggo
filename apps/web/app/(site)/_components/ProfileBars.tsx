/**
 * Tasting Note — 술은 Sweet·Acidity·Body·Fizz·Aroma, 음식은 Weight·Fat·Spice·Umami·Salt·Sweet를 1~5점 세로 눈금 막대로
 * (2026-10-03 UI 리뉴얼, 사용자 코멘트: 제목·축은 영어로, 점수가 한눈에 보이게 — 점수 숫자를 위에 크게, 한글은 작게).
 * 페어링 카드의 "맛 프로필" 줄과 같은 축·순서(shared pairing/summary.ts profileAxes). 축마다 '모름'이면 빈 막대 + "—".
 */
import { profileAxes, type DrinkProfile, type FoodProfile } from "@pairinggo/shared";

const EN: Record<string, string> = { sweet: "Sweet", acid: "Acidity", body: "Body", fizz: "Fizz", aroma: "Aroma", weight: "Weight", fat: "Fat", spice: "Spice", umami: "Umami", salt: "Salt" };

export default function ProfileBars({ kind, profile, unknown, id }: { kind: "drink" | "food"; profile?: DrinkProfile | FoodProfile; unknown?: string[]; id?: string }) {
  const axes = profileAxes(kind, profile, unknown);
  if (!axes.length) return null;
  return (
    <section className={`pbars v2 ${kind === "drink" ? "d" : "f"}`} aria-label="Tasting Note" id={id}>
      <div className="section-head"><h3>Tasting Note</h3><span className="small muted">1~5점</span></div>
      <dl>
        {axes.map((a) => (
          <div key={a.key} className={a.unknown ? "unk" : undefined}>
            <dd aria-label={a.unknown ? `${a.label} 모름` : `${a.label} ${a.value}점`}>
              <b className="score">{a.unknown ? "—" : a.value}<span>/5</span></b>
              <span className="cells">{[5, 4, 3, 2, 1].map((i) => <i key={i} className={!a.unknown && i <= a.value ? "on" : undefined} />)}</span>
            </dd>
            <dt><span className="en">{EN[a.key] ?? a.label}</span><span className="ko">{a.label}</span></dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
