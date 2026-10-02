/**
 * 기상청 초단기실황(공공데이터포털 VilageFcstInfoService_2.0/getUltraSrtNcst) — 시·도 대표 격자점의 지금 기온·강수형태(docs/29).
 * 키는 `DATA_GO_KR_KEY`(공공데이터포털 일반 인증키, 디코딩 값). 매시 정시 관측값이 10분쯤 뒤에 올라오므로
 * 10분 전이면 한 시간 앞 자료를 묻고, 그래도 없으면(NO_DATA) 한 시간 더 앞을 한 번 더 묻는다.
 * 손님 요청마다 부르지 않는다 — web lib/weather.ts가 weather_now 표에 60분 캐시.
 */
export type Nowcast = { temp: number | null; pty: number; rn1: number | null; observedAt: string /* ISO */ };

const BASE = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst";
const KST = 9 * 3600_000;

/** 관측 기준(base_date·base_time) — KST 정시, 10분 전이면 한 시간 앞. back만큼 시간을 더 물린다 */
export function nowcastBase(now: Date, back = 0): { date: string; time: string; iso: string } {
  const k = new Date(now.getTime() + KST);
  if (k.getUTCMinutes() < 10) k.setUTCHours(k.getUTCHours() - 1);
  k.setUTCHours(k.getUTCHours() - back, 0, 0, 0);
  const date = k.toISOString().slice(0, 10).replace(/-/g, ""), time = `${String(k.getUTCHours()).padStart(2, "0")}00`;
  return { date, time, iso: new Date(k.getTime() - KST).toISOString() };
}

const serviceKey = (key: string) => (key.includes("%") ? key : encodeURIComponent(key));

/** 한 격자점의 실황. 실패하면 던진다(호출한 쪽이 기록) */
export async function fetchNowcast(nx: number, ny: number, opts: { key?: string; now?: Date; fetchImpl?: typeof fetch } = {}): Promise<Nowcast> {
  const key = opts.key ?? process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error("DATA_GO_KR_KEY 없음");
  const f = opts.fetchImpl ?? fetch;
  let lastErr = "";
  for (let back = 0; back < 2; back++) {
    const b = nowcastBase(opts.now ?? new Date(), back);
    const url = `${BASE}?serviceKey=${serviceKey(key)}&pageNo=1&numOfRows=20&dataType=JSON&base_date=${b.date}&base_time=${b.time}&nx=${nx}&ny=${ny}`;
    const res = await f(url, { signal: AbortSignal.timeout(6000) });
    const text = await res.text();
    let j: { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: { category: string; obsrValue: string }[] } } } };
    try { j = JSON.parse(text); } catch { throw new Error(`기상청 응답이 JSON이 아님(${res.status}): ${text.slice(0, 80)}`); }
    const code = j.response?.header?.resultCode;
    if (code === "03") { lastErr = "NO_DATA"; continue; }          // 아직 올라오지 않은 시각 — 한 시간 앞으로
    if (code !== "00") throw new Error(`기상청 ${code ?? res.status}: ${j.response?.header?.resultMsg ?? text.slice(0, 80)}`);
    const items = j.response?.body?.items?.item ?? [];
    const val = (c: string) => { const v = items.find((x) => x.category === c)?.obsrValue; const n = v === undefined ? NaN : Number(v); return Number.isFinite(n) ? n : null; };
    return { temp: val("T1H"), pty: val("PTY") ?? 0, rn1: val("RN1"), observedAt: b.iso };
  }
  throw new Error(`기상청 ${lastErr}`);
}
