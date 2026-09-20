/**
 * "없는 술 요청" 모으기 — 결과 없던 검색어 + 식당 메뉴판·확인 정보의 술 이름 + 회원픽 글의 술 이름.
 * 규칙(카탈로그에 이미 있는 이름·음식·잡음 걸러내기, 출처 무게)은 shared `buildWantedList`.
 */
import { buildWantedList, type WantedInput, type WantedRow } from "@pairinggo/shared";
import { getCatalog } from "./catalog";
import { db } from "./db";

const DAYS = 90;

export async function wantedDrinks(limit = 200): Promise<{ rows: WantedRow[]; since: string; counts: { search: number; menu: number; pick: number } }> {
  const sb = db();
  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const c = await getCatalog();
  if (!sb) return { rows: [], since, counts: { search: 0, menu: 0, pick: 0 } };

  const [empties, places, picks] = await Promise.all([
    // ① 결과가 없던 검색어
    sb.from("search_logs").select("query_text,created_at").eq("kind", "search_empty").gte("created_at", since).limit(5000),
    // ② 식당 메뉴판·확인 정보에 적힌 술 이름 (카탈로그에 없어 이름 그대로 남은 것)
    sb.from("place_info").select("kakao_id,name,drink_names,drink_items,updated_at").limit(2000),
    // ③ 회원픽 글에 적힌, 카탈로그에 없는 술 이름(drink_raw)
    sb.from("member_picks").select("drink_raw,created_at").not("drink_raw", "is", null).gte("created_at", since).limit(2000),
  ]);

  const inputs: WantedInput[] = [];
  for (const r of empties.data ?? []) inputs.push({ name: String(r.query_text ?? ""), source: "search", at: r.created_at });
  for (const p of places.data ?? []) {
    const where = String((p as { name?: string }).name ?? "") || null;
    for (const n of ((p as { drink_names?: string[] }).drink_names ?? [])) inputs.push({ name: String(n), source: "menu", at: p.updated_at, where });
    for (const it of ((p as { drink_items?: { name?: string }[] }).drink_items ?? [])) if (it?.name) inputs.push({ name: String(it.name), source: "menu", at: p.updated_at, where });
  }
  for (const m of picks.data ?? []) if ((m as { drink_raw?: string }).drink_raw) inputs.push({ name: String((m as { drink_raw?: string }).drink_raw), source: "pick", at: m.created_at });

  const rows = buildWantedList(inputs, c.dataset.drinks, c.dataset.foods, { limit });
  const counts = { search: inputs.filter((i) => i.source === "search").length, menu: inputs.filter((i) => i.source === "menu").length, pick: inputs.filter((i) => i.source === "pick").length };
  return { rows, since, counts };
}
