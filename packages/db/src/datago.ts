/**
 * 공공데이터포털 "한국농수산식품유통공사_전통주정보" 오픈API 가져오기 (2026-09-27, docs/26 §2 D9)
 *  · 12열: 제품명·제품소개·알콜도수·용량·성분·특이사항·특징·판매여부·양조장·양조장주소·홈페이지주소·수상경력 (연 1회 갱신, 이용허락범위 제한 없음)
 *  · 키·주소는 packages/db/.env 에만: DATA_GO_KR_KEY(일반 인증키 Decoding 값), DATA_GO_KR_TRADLIQ_URL(활용신청 상세의 End Point,
 *    예: https://api.odcloud.kr/api/15048755/v1/uddi:xxxxxxxx-xxxx-...). 채팅·커밋에 키를 적지 않는다.
 *
 *  pnpm --filter @pairinggo/db datago            전량 받아 research/datago/전통주정보.json 에 저장 + 열 이름·건수 출력
 *  pnpm --filter @pairinggo/db datago --match    저장한 파일을 카탈로그와 대조 → 채울 수 있는 값(용량·홈페이지·수상·성분)과
 *                                                 제품소개 속 "어울리는 안주" 문장 후보를 research/datago/match-report.json 으로
 *  pnpm --filter @pairinggo/db datago --apply [--dry]   맞은 술에 ① 용량 → drink_specs(규격이 없는 술만) ② 성분 → attrs.ingredient(비어 있을 때만)
 *                                                 ③ 수상경력 → awards 합침(우리 두 대회 형식만) ④ 홈페이지 → 구매 링크 없는 술만, modoo.at 제외,
 *                                                 첫 화면에 그 술 이름이 보여야(showsDrink) ⑤ "어울리는 안주" 문장 → pairing_candidates(official, 검수 뒤 승격)
 *                                                 → 발행. 자동 대조가 안 붙는 행은 research/datago/overrides.json(사람 판단)으로.
 */
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DATA, cleanAttrs, cleanSpec, matchAwardDrink, mergeDrinkAwards, parseDrinkAward, parseMl } from "@pairinggo/shared";
import { publishCatalog, replaceSpecs } from "./catalog-write";
import { findFoods } from "./entity";
import { showsDrink } from "./link-check";
import { connect } from "./sql";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "research", "datago");
const RAW = join(dir, "전통주정보.json"), REPORT = join(dir, "match-report.json"), OVERRIDES = join(dir, "overrides.json"), APPLIED = join(dir, "apply-report.json");
const SOURCE_NAME = "한국농수산식품유통공사 전통주정보(공공데이터포털)", SOURCE_URL = "https://www.data.go.kr/data/15048755/fileData.do";
const PAIR = /(어울리|안주|곁들|페어링|함께\s*(드|먹|마시)|잘\s*맞)/;
const overrides = (): Record<string, string | null> => existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
/** 자동 대조 + 사람 판단(overrides) — null 은 "다른 술" */
function matchRow(r: Row, catalog: Parameters<typeof matchAwardDrink>[1]): string | null {
  const key = `${pick(r, "제품명")}|${pick(r, "양조장")}`;
  const ov = overrides();
  if (key in ov) return ov[key];
  return matchAwardDrink({ name: pick(r, "제품명"), brewery: pick(r, "양조장") || null, abv: Number(pick(r, "알콜도수").replace(/[^0-9.]/g, "")) || null }, catalog);
}
/** "950ml / 475ml" · "750ml, 375ml" → [950, 475] */
const volumes = (v: string): number[] => [...new Set(v.split(/[\/,·]|또는|및/).map((x) => parseMl(x.trim())).filter((n): n is number => n != null && n > 0))];
const sentencesOf = (r: Row) => [pick(r, "제품소개"), pick(r, "특징"), pick(r, "특이사항")].filter(Boolean).join(" ").split(/(?<=[.!?。])\s+|\n+/).filter((x) => PAIR.test(x)).map((x) => x.trim().slice(0, 200));

async function apply(dry: boolean) {
  const { rows } = JSON.parse(readFileSync(RAW, "utf8")) as { rows: Row[] };
  const sql = connect();
  const catalog = DATA.drinks.map((d) => ({ id: d.id, name: d.name, alias: d.alias ?? null, brewery: d.brewery ?? null, abv: d.abv ?? null }));
  const byId = new Map(DATA.drinks.map((d) => [d.id, d]));
  const rep = { at: new Date().toISOString(), dry, matched: 0, specs: [] as string[], ingredient: [] as string[], awards: [] as string[], awardsSkipped: [] as string[], homepage: [] as string[], homepageRejected: [] as string[], candidates: 0, candidatesDup: 0, candidateRows: [] as Row[] };
  try {
    const dbSpecs = new Map<string, number>();
    for (const r of await sql<{ drink_id: string; c: number }[]>`select drink_id, count(*)::int c from drink_specs group by 1`) dbSpecs.set(r.drink_id, r.c);
    type Cur = { attrs: Record<string, unknown>; awards: string[]; buy_url: string | null; alias: string[] };
    const dbDrinks = new Map<string, Cur>();
    for (const r of await sql<{ id: string; attrs: Record<string, unknown> | null; awards: string[] | null; buy_url: string | null; alias: string[] | null }[]>`select id, attrs, awards, buy_url, alias from drinks where not is_demo`) dbDrinks.set(r.id, { attrs: r.attrs ?? {}, awards: r.awards ?? [], buy_url: r.buy_url, alias: r.alias ?? [] });
    const batch = `datago-${new Date().toISOString().slice(0, 10)}`;
    for (const r of rows) {
      const id = matchRow(r, catalog);
      if (!id || !byId.has(id) || !dbDrinks.has(id)) continue;
      rep.matched++;
      const d = byId.get(id)!, cur = dbDrinks.get(id)!;
      // ① 용량 → 규격 (규격이 하나도 없는 술만)
      const mls = volumes(pick(r, "용량"));
      if (mls.length && !dbSpecs.get(id)) {
        const specs = mls.map((ml, i) => cleanSpec({ ml, pack: "bottle", bottles: 1, note: "공공데이터포털 전통주정보(2024-12-31)" }, `datago-${i}`));
        rep.specs.push(`${d.name}: ${mls.join("/")}mL`);
        if (!dry) { await sql.begin(async (tx) => { await replaceSpecs(tx, id, specs); }); dbSpecs.set(id, specs.length); }
      }
      // ② 성분 → attrs.ingredient (비어 있을 때만)
      const ing = pick(r, "성분").split(/[,、·]/).map((x) => x.replace(/\s*등$/, "").trim()).filter((x) => x.length >= 1 && x.length <= 20).slice(0, 12);
      const hasIng = Array.isArray(cur.attrs.ingredient) && (cur.attrs.ingredient as unknown[]).length > 0;
      let attrsNext: Record<string, unknown> | null = null;
      if (ing.length && !hasIng) { attrsNext = cleanAttrs("trad", { ...cur.attrs, ingredient: ing }); rep.ingredient.push(`${d.name}: ${ing.join(", ")}`); }
      // ③ 수상경력 → awards 합침 (우리 형식으로 읽히는 것만)
      const awardText = pick(r, "수상");
      let awardsNext: string[] | null = null;
      if (awardText) {
        // "… 대상 수상" 꼬리를 떼고, 우리가 아는 상 이름으로 읽힌 것만(자유 서술 "1위·입선·대축제"는 버림)
        const PRIZE_OK = /^(대통령상|대상|최우수상|우수상|장려상|금상|은상|동상|Best of Best|Best of \d{4})$/i;
        const parsed = awardText.split(/[,\n;]|\s{2,}/).map((a) => a.trim().replace(/\s*수상$/, "")).filter(Boolean).map(parseDrinkAward).filter((a): a is NonNullable<typeof a> => !!a && PRIZE_OK.test(a.prize) && (a.competition !== "대한민국주류대상" || a.year >= 2022));
        if (parsed.length) { const merged = mergeDrinkAwards(cur.awards, parsed); if (merged.length !== cur.awards.length) { awardsNext = merged; rep.awards.push(`${d.name}: ${merged.filter((x) => !cur.awards.includes(x)).join(" · ")}`); } }
        else rep.awardsSkipped.push(`${d.name}: ${awardText.slice(0, 80)}`);
      }
      // ④ 홈페이지 → 구매 링크가 없는 술만, modoo.at 제외, 첫 화면에 그 술 이름이 보여야
      const home = pick(r, "홈페이지");
      let buyNext: string | null = null;
      // 판매 페이지가 아닌 곳(블로그·SNS·modoo)은 안 쓴다. 스마트스토어는 규칙대로 확인 없이(화면이 스크립트로 그려져 이름 대조가 안 됨)
      if (home && !cur.buy_url && /^https?:\/\//.test(home) && !/(modoo\.at|facebook\.com|instagram\.com|blog\.naver\.com|cafe\.naver\.com|youtube\.com)/i.test(home)) {
        if (dry) rep.homepage.push(`${d.name}: ${home} (확인 예정)`);
        else if (/smartstore\.naver\.com|shopping\.naver\.com/.test(home)) { buyNext = home; rep.homepage.push(`${d.name}: ${home} (스마트스토어)`); }
        else { const chk = await showsDrink(home, [d.name, ...cur.alias]); if (chk?.found) { buyNext = chk.url; rep.homepage.push(`${d.name}: ${chk.url}`); } else rep.homepageRejected.push(`${d.name}: ${home}`); }
      }
      if (!dry && (attrsNext || awardsNext || buyNext)) {
        if (attrsNext) await sql`update drinks set attrs = ${sql.json(attrsNext as never)}, updated_at = now() where id = ${id}`;
        if (awardsNext) await sql`update drinks set awards = ${sql.json(awardsNext as never)}, updated_at = now() where id = ${id}`;
        if (buyNext) await sql`update drinks set buy_url = ${buyNext}, buy_store = ${/smartstore|shopping\.naver/.test(buyNext) ? "스마트스토어" : "공식 홈페이지"}, updated_at = now() where id = ${id}`;
      }
      // ⑤ 어울리는 안주 문장 → 후보(official) — 문장 속 카탈로그 음식 이름마다 한 줄, 검수 화면에서 승격
      for (const sen of sentencesOf(r)) {
        for (const f of findFoods(sen)) {
          rep.candidateRows.push({ drink: d.name, food: f.term, quote: sen });
          if (dry) { rep.candidates++; continue; }
          try {
            await sql`insert into pairing_candidates (drink_raw, food_raw, drink_id, food_id, source_name, url, quote, who, suggested_tier, suggested_score, suggested_reason, origin, source_kind, query, mention_count, status, batch)
              values (${d.name}, ${f.term}, ${id}, ${f.id}, ${SOURCE_NAME}, ${SOURCE_URL}, ${sen}, ${pick(r, "양조장") || d.brewery || null}, 'official', 90, ${"양조장이 aT 전통주정보에 등록한 제품 설명"}, 'sheet', 'datago', ${pick(r, "제품명")}, 1, 'draft', ${batch})`;
            rep.candidates++;
          } catch (e) { if ((e as { code?: string }).code === "23505") rep.candidatesDup++; else throw e; }
        }
      }
    }
    if (!dry && (rep.specs.length || rep.ingredient.length || rep.awards.length || rep.homepage.length)) await publishCatalog(sql, "공공데이터포털 전통주정보 반영(용량·성분·수상·홈페이지)");
  } finally { await sql.end(); }
  writeFileSync(APPLIED, JSON.stringify(rep, null, 1));
  console.log(`${dry ? "[미리보기] " : ""}맞은 술 ${rep.matched} — 규격 ${rep.specs.length} · 성분 ${rep.ingredient.length} · 수상 ${rep.awards.length}(못 읽음 ${rep.awardsSkipped.length}) · 홈페이지 ${rep.homepage.length}(거부 ${rep.homepageRejected.length}) · 안주 후보 ${rep.candidates}(중복 ${rep.candidatesDup})`);
  console.log(`보고서: ${APPLIED}`);
}

const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);

type Row = Record<string, unknown>;
const pick = (r: Row, ...names: string[]): string => {
  for (const n of names) { const k = Object.keys(r).find((x) => x.replace(/\s/g, "").includes(n)); if (k && r[k] != null && String(r[k]).trim()) return String(r[k]).trim(); }
  return "";
};

async function fetchAll(): Promise<Row[]> {
  const key = process.env.DATA_GO_KR_KEY, url = process.env.DATA_GO_KR_TRADLIQ_URL;
  if (!key || !url) throw new Error("packages/db/.env 에 DATA_GO_KR_KEY 와 DATA_GO_KR_TRADLIQ_URL 을 넣어 주세요");
  const out: Row[] = [];
  for (let page = 1; page <= 100; page++) {
    const u = new URL(url);
    u.searchParams.set("page", String(page)); u.searchParams.set("perPage", "100"); u.searchParams.set("returnType", "JSON");
    // odcloud 는 헤더(Authorization: Infuser 키)와 serviceKey 쿼리 둘 다 받는다 — 헤더가 인코딩 문제가 없다
    let res = await fetch(u, { headers: { Authorization: `Infuser ${key}` } });
    if (res.status === 401 || res.status === 403) { u.searchParams.set("serviceKey", key); res = await fetch(u); }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { data?: Row[]; totalCount?: number; currentCount?: number; page?: number; perPage?: number; response?: { body?: { items?: Row[] | { item?: Row[] }; totalCount?: number } } };
    // odcloud(파일데이터 변환) 형식: { page, perPage, totalCount, currentCount, data: [...] } / 일반 openapi 형식: response.body.items
    const rows = j.data ?? (Array.isArray(j.response?.body?.items) ? j.response!.body!.items as Row[] : (j.response?.body?.items as { item?: Row[] } | undefined)?.item) ?? [];
    out.push(...rows);
    const total = j.totalCount ?? j.response?.body?.totalCount ?? 0;
    process.stdout.write(`  ${page}쪽 ${rows.length}건 (누적 ${out.length}${total ? ` / ${total}` : ""})\n`);
    if (!rows.length || (total && out.length >= total)) break;
  }
  return out;
}

async function main() {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  if (flag("apply")) { if (!existsSync(RAW)) throw new Error("먼저 `datago` 로 받아 주세요"); return apply(flag("dry")); }
  if (!flag("match")) {
    const rows = await fetchAll();
    writeFileSync(RAW, JSON.stringify({ fetchedAt: new Date().toISOString(), source: "한국농수산식품유통공사_전통주정보 (공공데이터포털, 이용허락범위 제한 없음)", count: rows.length, rows }, null, 1));
    console.log(`저장: ${RAW} — ${rows.length}건`);
    if (rows[0]) { console.log("열:", Object.keys(rows[0]).join(" · ")); console.log("첫 줄:", JSON.stringify(rows[0]).slice(0, 400)); }
    return;
  }
  if (!existsSync(RAW)) throw new Error("먼저 `datago` 로 받아 주세요");
  const { rows } = JSON.parse(readFileSync(RAW, "utf8")) as { rows: Row[] };
  const catalog = DATA.drinks.map((d) => ({ id: d.id, name: d.name, alias: d.alias ?? null, brewery: d.brewery ?? null, abv: d.abv ?? null }));
  const byId = new Map(DATA.drinks.map((d) => [d.id, d]));
  let matched = 0, unmatched = 0, ml = 0, home = 0, awards = 0, ingr = 0, pairSent = 0;
  const items: Row[] = [], pairSamples: Row[] = [], unmatchedNames: string[] = [];
  for (const r of rows) {
    const name = pick(r, "제품명"), brewery = pick(r, "양조장") && pick(r, "양조장");
    const id = matchRow(r, catalog);
    const desc = [pick(r, "제품소개"), pick(r, "특징"), pick(r, "특이사항")].filter(Boolean).join(" ");
    const sentences = desc.split(/(?<=[.!?。])\s+|\n+/).filter((s) => PAIR.test(s)).map((s) => s.trim().slice(0, 200));
    if (!id) { unmatched++; if (unmatchedNames.length < 400) unmatchedNames.push(`${name} (${brewery})`); continue; }
    matched++;
    const d = byId.get(id)!;
    const volume = parseMl(pick(r, "용량")), site = pick(r, "홈페이지"), award = pick(r, "수상"), ing = pick(r, "성분");
    const fill = { ml: volume != null && !(d.specs?.length) ? volume : null, homepage: site && !d.buy?.url ? site : null, awards: award && !(d.awards?.length) ? award : null, ingredients: ing || null, pairing: sentences };
    if (fill.ml) ml++; if (fill.homepage) home++; if (fill.awards) awards++; if (fill.ingredients) ingr++; if (sentences.length) { pairSent++; if (pairSamples.length < 15) pairSamples.push({ id, name: d.name, sentences }); }
    items.push({ id, catalogName: d.name, apiName: name, brewery, abv: pick(r, "알콜도수"), volume: pick(r, "용량"), sale: pick(r, "판매여부"), fill });
  }
  writeFileSync(REPORT, JSON.stringify({ at: new Date().toISOString(), rows: rows.length, matched, unmatched, canFill: { ml, homepage: home, awards, ingredients: ingr, pairingSentences: pairSent }, pairSamples, unmatchedNames, items }, null, 1));
  console.log(`대조: ${rows.length}건 중 카탈로그와 맞음 ${matched} · 없음 ${unmatched}`);
  console.log(`채울 수 있는 값 — 용량 ${ml} · 홈페이지 ${home} · 수상 ${awards} · 성분 ${ingr} · 어울리는 안주 문장 있는 술 ${pairSent}`);
  console.log(`보고서: ${REPORT}`);
  for (const s of pairSamples.slice(0, 5)) console.log(`  ${s.name}: ${(s.sentences as string[])[0]}`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
