"use client";
/**
 * 양쪽 손잡이 범위 슬라이더 + 직접 입력 — 가격·용량·도수가 같은 부품을 쓴다(2026-09-24, 요구사항 §4·§5).
 *  · 겹친 <input type=range> 둘(최소·최대) — 키보드 ←→로 조절, 손잡이 44px, 라벨은 "최소 가격"·"최대 가격"처럼 구분.
 *  · 최대 손잡이가 맨 오른쪽이면 **상한 없음**(max: null). "1,000,000원 이상"은 눈금의 끝 표시이지 제한이 아니다.
 *  · 직접 입력이 눈금을 넘으면 눈금을 넓힌다(sliderMax). 375처럼 눈금 간격에 안 맞는 값도 그대로 둔다.
 *  · 최소 > 최대면 오류 문구를 내고 부모가 적용을 막는다(rangeValid).
 */
import { useId, useState } from "react";
import { rangeValid, sliderMax, type Range } from "@pairinggo/shared/filter-url";

type Props = {
  label: string;                // "가격"
  unit: string;                 // "원" · "mL" · "%"
  base: number;                 // 기본 눈금 끝(1,000,000 · 3,000)
  step: number;                 // 1,000 · 10
  value: Range;
  onChange: (r: Range) => void;
  /** 화면 표시 — 천 단위 쉼표 */
  format?: (n: number) => string;
  /** 상한 없음일 때 최대 입력칸 안내 */
  noMaxText?: string;
};

const digits = (s: string) => s.replace(/[^\d]/g, "");
const fmtDefault = (n: number) => n.toLocaleString("ko-KR");

export default function RangeSlider({ label, unit, base, step, value, onChange, format = fmtDefault, noMaxText = "상한 없음" }: Props) {
  const id = useId();
  const top = sliderMax(base, step, value.min, value.max);
  const minV = value.min ?? 0;
  const maxV = value.max ?? top;        // 오른쪽 끝 = 상한 없음
  const valid = rangeValid(value);
  // 입력 중인 글자(쉼표 포함)를 그대로 두었다가 blur·Enter에 값으로 확정
  const [minText, setMinText] = useState<string | null>(null);
  const [maxText, setMaxText] = useState<string | null>(null);

  const setMin = (n: number | null) => onChange({ min: n == null || n <= 0 ? null : n, max: value.max });
  const setMax = (n: number | null) => onChange({ min: value.min, max: n });
  const commitMin = () => { if (minText == null) return; const d = digits(minText); setMin(d ? Number(d) : null); setMinText(null); };
  const commitMax = () => { if (maxText == null) return; const d = digits(maxText); setMax(d ? Number(d) : null); setMaxText(null); };
  const onKey = (commit: () => void) => (e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); commit(); } };

  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / top) * 100))}%`;

  return (
    <div className="rs2" data-invalid={!valid ? "1" : undefined}>
      <p className="rs2-now" aria-live="polite">
        {format(minV)}{unit} ~ {value.max == null ? `${format(top)}${unit} 이상` : `${format(value.max)}${unit}`}
      </p>
      <div className="rs2-track" style={{ ["--lo" as string]: pct(minV), ["--hi" as string]: pct(Math.min(maxV, top)) }}>
        <span className="rs2-rail" aria-hidden />
        <span className="rs2-fill" aria-hidden />
        <input type="range" id={`${id}-min`} aria-label={`최소 ${label}`} min={0} max={top} step={step} value={Math.min(minV, top)}
          onChange={(e) => setMin(Number(e.target.value))}
          aria-valuetext={`${format(minV)}${unit}`} className={minV >= top - step ? "front" : undefined} />
        <input type="range" id={`${id}-max`} aria-label={`최대 ${label}`} min={0} max={top} step={step} value={Math.min(maxV, top)}
          onChange={(e) => { const n = Number(e.target.value); setMax(n >= top ? null : n); }}
          aria-valuetext={value.max == null ? "상한 없음" : `${format(value.max)}${unit}`} />
      </div>
      <div className="rs2-inputs">
        <label>
          <span>최소 {label}</span>
          <input inputMode="numeric" value={minText ?? (value.min == null ? "" : format(value.min))} placeholder="0"
            onChange={(e) => setMinText(e.target.value)} onBlur={commitMin} onKeyDown={onKey(commitMin)} aria-invalid={!valid} />
          <em>{unit}</em>
        </label>
        <span className="rs2-tilde" aria-hidden>~</span>
        <label>
          <span>최대 {label}</span>
          <input inputMode="numeric" value={maxText ?? (value.max == null ? "" : format(value.max))} placeholder={noMaxText}
            onChange={(e) => setMaxText(e.target.value)} onBlur={commitMax} onKeyDown={onKey(commitMax)} aria-invalid={!valid} />
          <em>{unit}</em>
        </label>
      </div>
      {!valid && <p className="rs2-err" role="alert">최대 {label}이 최소 {label}보다 작습니다. 값을 바꿔 주세요.</p>}
    </div>
  );
}
