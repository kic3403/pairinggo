/**
 * 규격(용량·빈티지)·참고가격 정리와 표시(2026-09-24).
 *  · 용량은 mL 정수로 통일 — "1L"→1000, "1.8L"→1800, "720ml"→720, "375"→375. 0이나 못 읽는 값은 null(미확인).
 *  · 가격은 KRW 정수 — 0원·음수·못 읽는 값은 null(미확인). 미확인을 0으로 저장하지 않는다.
 *  · 참고가격 = 그 규격 한 병 기준, 배송비·쿠폰·회원 혜택 제외(사용자 결정 2026-09-24). 페어링GO 판매가가 아니다.
 */
import type { DrinkSpec, SpecPrice } from "../types";

export const ML_MAX = 50_000, KRW_MAX = 50_000_000;
export const PRICE_TYPE_LABEL: Record<SpecPrice["type"], string> = { msrp: "권장소비자가", retail: "판매처 가격" };
export const PRICE_BASIS_NOTE = "참고가격은 해당 용량 한 병 기준이며 배송비·쿠폰·회원 혜택은 포함하지 않습니다. 페어링GO가 파는 가격이 아니라 확인일 기준의 권장소비자가 또는 판매처 가격입니다.";

/** 용량 → mL 정수. "1.8L"·"1,000ml"·"720"·720 모두 받는다. 0 이하·범위 밖·빈칸 → null */
export function parseMl(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 && v <= ML_MAX ? Math.round(v) : null;
  const s = String(v).trim().toLowerCase().replace(/[\s,]/g, "");
  const m = s.match(/^(\d+(?:\.\d+)?)(ml|mℓ|cc|l|ℓ)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const ml = m[2] === "l" || m[2] === "ℓ" ? n * 1000 : n;
  return parseMl(ml);
}
/** 가격 → 원 정수. "38,000원"·"3.8만"·38000 — 0 이하·못 읽음 → null */
export function parseKrw(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) && v > 0 && v <= KRW_MAX ? Math.round(v) : null;
  const s = String(v).replace(/[\s,₩원]/g, "");
  const man = s.match(/^(\d+(?:\.\d+)?)만(?:(\d+)천)?$/);
  if (man) return parseKrw(Number(man[1]) * 10000 + (man[2] ? Number(man[2]) * 1000 : 0));
  return /^\d+(\.\d+)?$/.test(s) ? parseKrw(Number(s)) : null;
}
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const cleanDate = (v: unknown): string | null => {
  const s = String(v ?? "").trim().replace(/[./]/g, "-");
  if (DATE.test(s) && !Number.isNaN(Date.parse(s))) return s;
  const d = v instanceof Date ? v : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
};

/** 가격 한 건 정리 — 금액·출처·확인일이 없으면 null(넣지 않는다) */
export function cleanPrice(raw: unknown): SpecPrice | null {
  const o = (raw ?? {}) as Record<string, unknown>;
  const krw = parseKrw(o.krw ?? o.price);
  const checked = cleanDate(o.checked ?? o.checked_on);
  const source = String(o.source ?? "").trim().slice(0, 80);
  if (!krw || !checked || !source) return null;
  const type = o.type === "msrp" || o.price_type === "msrp" ? "msrp" : "retail";
  const url = String(o.url ?? o.source_url ?? "").trim();
  return { krw, type, source, url: /^https?:\/\//.test(url) ? url.slice(0, 500) : null, checked };
}
/** 규격 정리 — 용량 미확인은 null 그대로(0 금지), 세트는 병 수 2 이상 */
export function cleanSpec(raw: unknown, id = ""): DrinkSpec {
  const o = (raw ?? {}) as Record<string, unknown>;
  const bottlesRaw = Math.floor(Number(o.bottles ?? 1));
  const pack: DrinkSpec["pack"] = o.pack === "set" ? "set" : "bottle";
  const abv = o.abv == null || o.abv === "" ? null : Number(o.abv);
  const prices = (Array.isArray(o.prices) ? o.prices : []).map(cleanPrice).filter((p): p is SpecPrice => !!p).sort((a, b) => a.krw - b.krw);
  return {
    id: String(o.id ?? id),
    ml: parseMl(o.ml ?? o.volume_ml ?? o.volume),
    abv: abv != null && Number.isFinite(abv) && abv >= 0 && abv <= 80 ? Math.round(abv * 10) / 10 : null,
    vintage: String(o.vintage ?? "").trim().slice(0, 20) || null,
    pack, bottles: pack === "set" ? Math.max(2, Number.isFinite(bottlesRaw) ? bottlesRaw : 2) : 1,
    note: String(o.note ?? "").trim().slice(0, 120) || null,
    prices,
  };
}

/** 규격의 대표(최저) 참고가격 — 없으면 null */
export const specPrice = (s: DrinkSpec): SpecPrice | null => (s.prices.length ? s.prices.reduce((a, b) => (b.krw < a.krw ? b : a)) : null);
/** 한 병 규격만 */
export const bottleSpecs = (specs?: DrinkSpec[]) => (specs ?? []).filter((s) => s.pack === "bottle");

export const fmtKrw = (n: number) => `${n.toLocaleString("ko-KR")}원`;
export const fmtMl = (n: number) => `${n.toLocaleString("ko-KR")}mL`;
/** 카드 한 줄 — "720mL · 참고가격 38,000원" / "720mL · 가격 정보 없음" / "용량·가격 정보 없음" */
export function specLine(spec: DrinkSpec | null, price: number | null): string {
  if (!spec) return "용량·가격 정보 없음";
  const vol = spec.ml != null ? fmtMl(spec.ml) : "용량 미확인";
  return `${vol} · ${price != null ? `참고가격 ${fmtKrw(price)}` : "가격 정보 없음"}`;
}
