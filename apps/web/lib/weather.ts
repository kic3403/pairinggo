/**
 * 시·도별 지금 날씨 — weather_now(0052) 캐시 + 기상청 초단기실황(packages/server weather.ts). docs/29.
 * 60분 안 값은 그대로, 오래됐으면 한 번 받아 덮어쓴다. 실패하면 3시간 안 옛 값이라도 쓰고, 그것도 없으면 null(계절만으로 추천).
 * 같은 시·도의 동시 요청은 한 번만 부른다(inflight). DB가 없으면(정적 폴백) 프로세스 메모만.
 */
import { fetchNowcast } from "@pairinggo/server";
import { WEATHER_GRID, type WeatherNow } from "@pairinggo/shared";
import { db } from "./db";
import { reportError } from "@pairinggo/server/errors";

const FRESH_MS = 60 * 60_000;      // 이 안이면 다시 받지 않는다
const STALE_OK_MS = 3 * 3600_000;  // 조회 실패 때 이 안의 옛 값은 쓴다
const MEMO_MS = 5 * 60_000;        // 프로세스 메모(같은 함수 인스턴스 안에서 DB도 덜 읽게)

type Row = { sido: string; temp: number | null; pty: number; rn1: number | null; observed_at: string | null; fetched_at: string; error: string | null };
const memo = new Map<string, { at: number; val: WeatherNow | null }>();
const inflight = new Map<string, Promise<WeatherNow | null>>();

const toNow = (r: Row): WeatherNow => ({ sido: r.sido, temp: r.temp === null ? null : Number(r.temp), pty: Number(r.pty ?? 0), rn1: r.rn1 === null ? null : Number(r.rn1), at: r.observed_at ?? r.fetched_at });
const age = (iso: string | null | undefined) => (iso ? Date.now() - Date.parse(iso) : Infinity);

export async function weatherFor(sido: string): Promise<WeatherNow | null> {
  const grid = WEATHER_GRID[sido];
  if (!grid) return null;
  const m = memo.get(sido);
  if (m && Date.now() - m.at < MEMO_MS) return m.val;
  const running = inflight.get(sido);
  if (running) return running;
  const p = (async () => {
    const sb = db();
    let row: Row | null = null;
    if (sb) { const { data } = await sb.from("weather_now").select("*").eq("sido", sido).maybeSingle(); row = (data as Row | null) ?? null; }
    if (row && !row.error && age(row.fetched_at) < FRESH_MS) return toNow(row);
    if (row && row.error && age(row.fetched_at) < 10 * 60_000) return row.observed_at && age(row.observed_at) < STALE_OK_MS ? toNow(row) : null;   // 방금 실패했으면 10분은 다시 묻지 않는다
    try {
      const n = await fetchNowcast(grid.nx, grid.ny);
      const next: Row = { sido, temp: n.temp, pty: n.pty, rn1: n.rn1, observed_at: n.observedAt, fetched_at: new Date().toISOString(), error: null };
      if (sb) await sb.from("weather_now").upsert(next, { onConflict: "sido" });
      return toNow(next);
    } catch (e) {
      void reportError("web", "weather", e, { sido });
      if (sb) await sb.from("weather_now").upsert({ sido, temp: row?.temp ?? null, pty: row?.pty ?? 0, rn1: row?.rn1 ?? null, observed_at: row?.observed_at ?? null, fetched_at: new Date().toISOString(), error: (e as Error).message.slice(0, 200) }, { onConflict: "sido" }).then(() => {}, () => {});
      return row?.observed_at && age(row.observed_at) < STALE_OK_MS ? toNow(row) : null;
    }
  })();
  inflight.set(sido, p);
  try { const val = await p; memo.set(sido, { at: Date.now(), val }); return val; }
  finally { inflight.delete(sido); }
}
