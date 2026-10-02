/**
 * 대시보드 꺾은선 그래프(2026-10-02 사용자 요청 — 한눈에 보는 x·y축 그래프). 가로축 = 날짜(하루짜리 기간은 시간), 세로축 = 건수.
 * 서버에서 SVG로 그린다(라이브러리·스크립트 없음). 칸·눈금 계산은 shared ops-series.ts.
 * 점에 마우스를 올리면 그 칸의 값이 뜨고(title), 아래 '숫자로 보기'에 같은 값이 표로 있다(그림을 못 보는 경우에도 읽을 수 있게).
 */
import { niceMax, xLabelIndexes, yTicks, type SeriesAxis } from "@pairinggo/shared";

export type ChartLine = { name: string; color: string; values: number[]; dashed?: boolean };

const W = 560, H = 236, L = 44, R = 14, T = 14, B = 30;

export default function OpsChart({ title, note, axis, lines }: { title: string; note?: string; axis: SeriesAxis; lines: ChartLine[] }) {
  const n = axis.buckets.length;
  if (!n) return null;
  const top = niceMax(Math.max(0, ...lines.flatMap((l) => l.values)));
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
  const y = (v: number) => T + ih - (ih * v) / top;
  const fmt = (v: number) => v.toLocaleString("ko-KR");
  const dots = n <= 40;   // 칸이 많으면 점은 빼고 선만
  const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
  return (
    <figure className="ochart">
      <figcaption>
        <b>{title}</b>
        <span className="olegend">
          {lines.map((l) => <span key={l.name}><i style={{ background: l.color }} />{l.name} <em>{fmt(sum(l.values))}</em></span>)}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} — ${lines.map((l) => `${l.name} 합계 ${fmt(sum(l.values))}`).join(", ")}. ${axis.buckets[0].label}부터 ${axis.buckets[n - 1].label}까지 ${axis.unit === "hour" ? "시간" : "날짜"}별`}>
        {/* 세로축 눈금과 가로 줄 */}
        {yTicks(top).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={v === 0 ? 1.2 : 1} strokeDasharray={v === 0 ? undefined : "3 3"} />
            <text x={L - 7} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{fmt(v)}</text>
          </g>
        ))}
        {/* 가로축 글자 — 많으면 건너뛴다 */}
        {xLabelIndexes(n).map((i) => (
          <text key={i} x={x(i)} y={H - 9} textAnchor={i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle"} fontSize="11" fill="var(--muted)">{axis.buckets[i].label}</text>
        ))}
        {lines.map((l) => (
          <g key={l.name}>
            {n > 1 && <polyline fill="none" stroke={l.color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={l.dashed ? "5 4" : undefined} points={l.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />}
            {(dots || n === 1) && l.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={n === 1 ? 4 : 2.8} fill="var(--surface)" stroke={l.color} strokeWidth="1.8">
                <title>{`${axis.buckets[i].label} · ${l.name} ${fmt(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {note && <p className="muted" style={{ margin: "2px 0 0" }}>{note}</p>}
      <details className="otable">
        <summary>숫자로 보기</summary>
        <div className="oscroll">
          <table>
            <thead><tr><th>{axis.unit === "hour" ? "시간" : "날짜"}</th>{lines.map((l) => <th key={l.name}>{l.name}</th>)}</tr></thead>
            <tbody>{axis.buckets.map((b, i) => <tr key={b.start}><td>{b.label}</td>{lines.map((l) => <td key={l.name}>{fmt(l.values[i] ?? 0)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
