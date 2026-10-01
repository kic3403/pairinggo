/**
 * 상세 주소(술·음식·모음) 앞단 처리 두 가지.
 *
 * ① 술·음식 상세 주소에 낱개 '%'가 섞이면 Next.js가 경로 값을 풀다 멈춰 500을 낸다("failed to decode param", 2026-09-29 확인 —
 *    예: 이름에 %가 있는 "금과명주 40%"를 주소창에 그대로 적으면 /drinks/금과명주-40%). 우리 코드에 닿기 전이라 페이지에서는 못 막는다.
 *    슬러그(toSlug)는 원래 기호를 지우므로, '%'를 빼고 같은 주소로 영구 이동시킨다. 정상 주소는 그대로 지나간다.
 *
 * ② 없는 술·음식·모음 주소는 **404로 답한다**(2026-10-02). 화면 사이 뼈대(loading.tsx) 때문에 Next.js는 본문을 흘려 보내기 시작한 뒤에야
 *    notFound()를 만나 상태 코드를 못 바꾸고 200으로 답했다(noindex 메타만 붙음 — 검색엔진이 '없는 화면'을 정상 화면으로 볼 수 있다).
 *    그래서 화면을 그리기 전에 여기서 있는 주소 목록(/api/v1/slugs, 5분 기억)과 대조해 없으면 상태만 404로 바꾼다(화면은 "찾을 수 없는…" 그대로).
 *    목록을 못 받았거나 방금 발행해 아직 목록에 없는 주소는 **그냥 통과**시킨다 — 있는 화면을 404로 답하는 쪽이 더 나쁘다.
 */
import { NextResponse, type NextRequest } from "next/server";
import { slugKey } from "@pairinggo/shared/slug";

type Section = "drinks" | "foods" | "guide";
type SlugSets = Record<Section, Set<string>>;
/** 동적 구간이 아니라 고정 화면인 하위 주소 — 대조하지 않는다 */
const STATIC_CHILD: Record<Section, string[]> = { drinks: ["categories"], foods: [], guide: [] };
const TTL_MS = 5 * 60 * 1000, RETRY_MS = 30 * 1000;

let cache: { at: number; sets: SlugSets | null } | null = null;
let loading: Promise<SlugSets | null> | null = null;

async function slugSets(origin: string): Promise<SlugSets | null> {
  const now = Date.now();
  if (cache && now - cache.at < (cache.sets ? TTL_MS : RETRY_MS)) return cache.sets;
  if (!loading) {
    loading = (async () => {
      try {
        const r = await fetch(`${origin}/api/v1/slugs`, { signal: AbortSignal.timeout(2500) });
        if (!r.ok) return null;
        const j = (await r.json()) as Partial<Record<Section, unknown>>;
        const set = (v: unknown) => new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
        const sets = { drinks: set(j.drinks), foods: set(j.foods), guide: set(j.guide) };
        // 비어 있으면 믿지 않는다(카탈로그를 못 읽은 응답으로 전부 404가 되는 사고 방지)
        return sets.drinks.size && sets.foods.size ? sets : null;
      } catch { return null; }
    })().then((sets) => { cache = { at: Date.now(), sets: sets ?? cache?.sets ?? null }; loading = null; return cache.sets; });
  }
  // 예전 목록이 있으면 기다리지 않고 그것으로 답한다(새 목록은 뒤에서 받는다)
  return cache?.sets ?? loading;
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const i = pathname.indexOf("/", 1);
  const section = pathname.slice(1, i) as Section;
  const raw = pathname.slice(i + 1);
  let once: string;
  try { once = decodeURIComponent(raw); } catch { once = raw; }
  if (once.includes("%")) {
    const url = req.nextUrl.clone();
    url.pathname = `${pathname.slice(0, i)}/${encodeURIComponent(once.replace(/%/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, ""))}`;
    return NextResponse.redirect(url, 308);
  }
  if (!(section in STATIC_CHILD) || STATIC_CHILD[section].includes(once)) return NextResponse.next();
  const sets = await slugSets(req.nextUrl.origin);
  const key = slugKey(once);
  if (!sets || !key || sets[section].has(key)) return NextResponse.next();
  // 같은 주소를 그대로 그리되 상태만 404 — 화면은 페이지의 notFound()가 "찾을 수 없는…"으로 보여 준다
  return NextResponse.rewrite(req.nextUrl, { status: 404 });
}

export const config = { matcher: ["/drinks/:slug", "/foods/:slug", "/guide/:slug"] };
