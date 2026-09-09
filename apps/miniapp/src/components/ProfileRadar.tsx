import { PROFILE_META, type DrinkProfile } from "@pairinggo/shared";

const KEYS: (keyof DrinkProfile)[] = ["sweet", "acid", "body", "fizz", "aroma"];

/** 술 맛 프로필 5축 레이더 (1~5). 색은 테마 토큰(currentColor)으로 라이트·다크 대응 */
export default function ProfileRadar({ profile, compare, size = 150 }: { profile: DrinkProfile; compare?: DrinkProfile; size?: number }) {
  const cx = size / 2, cy = size / 2, R = size / 2 - 22;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / KEYS.length;
  const pt = (i: number, v: number) => [cx + Math.cos(angle(i)) * R * (v / 5), cy + Math.sin(angle(i)) * R * (v / 5)] as const;
  const poly = (p: DrinkProfile) => KEYS.map((k, i) => pt(i, p[k] || 0).join(",")).join(" ");
  const labels = PROFILE_META.drink_keys;
  return (
    <div className="mt-3 flex items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={KEYS.map((k) => `${labels[k]} ${profile[k]}`).join(", ")} className="shrink-0">
        {[1, 2, 3, 4, 5].map((r) => (
          <polygon key={r} points={KEYS.map((_, i) => pt(i, r).join(",")).join(" ")} fill="none" stroke="var(--line)" strokeWidth={r === 5 ? 1 : 0.6} />
        ))}
        {KEYS.map((_, i) => { const [x, y] = pt(i, 5); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--line)" strokeWidth={0.6} />; })}
        {compare && <polygon points={poly(compare)} fill="var(--muted)" fillOpacity={0.15} stroke="var(--muted)" strokeWidth={1} strokeDasharray="3 2" />}
        <polygon points={poly(profile)} fill="var(--drink)" fillOpacity={0.22} stroke="var(--drink)" strokeWidth={1.6} />
        {KEYS.map((k, i) => { const [x, y] = pt(i, profile[k] || 0); return <circle key={k} cx={x} cy={y} r={2.6} fill="var(--drink)" />; })}
        {KEYS.map((k, i) => {
          const [x, y] = pt(i, 6.15);
          return <text key={k} x={x} y={y} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill="var(--ink2)">{labels[k]}</text>;
        })}
      </svg>
      <div className="flex-1 min-w-0 grid grid-cols-1 gap-1 text-[12px]">
        {KEYS.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-11 text-ink2">{labels[k]}</span>
            <span className="flex-1 h-[5px] rounded bg-surface2 overflow-hidden"><i className="block h-full rounded bg-drink" style={{ width: `${((profile[k] || 0) / 5) * 100}%` }} /></span>
            <span className="w-3 text-right num text-muted">{profile[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
