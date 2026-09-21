/**
 * 판매 수수료(2026-09-21 사용자 결정, docs/22 §3) — 파트너가 내는 돈은 둘로 나뉜다.
 *   ① 페어링GO 앱 수수료(중개 수수료) — 시범 3개월 0% → 5%
 *   ② 결제대행사(PG) 수수료 — 2.5% 내외, PG 계약·결제수단에 따라 달라진다
 * 두 값을 섞어 적지 않는다 — 파트너가 "얼마를 누구에게 내는지" 헷갈리면 입점 상담이 길어진다.
 */

/** 시범 입점 기간(개월) — 이 기간에는 앱 수수료를 받지 않는다 */
export const TRIAL_MONTHS = 3;
/** 시범 기간 앱 수수료(%) */
export const APP_FEE_TRIAL = 0;
/** 시범 기간이 끝난 뒤 앱 수수료(%) */
export const APP_FEE = 5;
/** 결제대행사 수수료(%) — 계약 전 기준값. 실제 값은 PG 계약서를 따른다 */
export const PG_FEE = 2.5;
/** 앱 수수료 상한 — 운영자가 실수로 큰 값을 넣지 못하게 */
export const APP_FEE_MAX = 30;

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** "앱 수수료 5% + 결제수수료 2.5% = 7.5%" — 파트너 화면·약관에 같은 문장을 쓴다 */
export function feeText(appFee: number, pgFee: number = PG_FEE): string {
  const app = Math.max(0, appFee), pg = Math.max(0, pgFee);
  return `앱 수수료 ${pct(app)} + 결제수수료 ${pct(pg)} = ${pct(Math.round((app + pg) * 10) / 10)}`;
}

/** 파트너가 실제로 부담하는 합계(%) */
export const totalFee = (appFee: number, pgFee: number = PG_FEE) =>
  Math.round((Math.max(0, appFee) + Math.max(0, pgFee)) * 10) / 10;

/** 판매가에서 떼는 금액(원) — 앱·PG를 나눠 돌려준다. 배송비는 수수료 대상이 아니다 */
export function feeAmounts(itemsTotal: number, appFee: number, pgFee: number = PG_FEE) {
  const base = Math.max(0, Math.floor(itemsTotal || 0));
  const app = Math.round((base * Math.max(0, appFee)) / 100);
  const pg = Math.round((base * Math.max(0, pgFee)) / 100);
  return { app, pg, total: app + pg, payout: base - app - pg };
}
