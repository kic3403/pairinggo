/**
 * 라벨 사진으로 찾기(docs/25 §5) — POST { images: [{ type, data(base64) }] } → { read, matches, query }.
 * 사진은 저장하지 않는다. IP당 분당 4번, 하루 전체 300번(LABEL_READS_PER_DAY) — Claude 호출 비용 보호.
 */
import { NextResponse } from "next/server";
import { checkMenuImages, menuReadError } from "@pairinggo/server/menu-read";
import { rateLimit } from "@/lib/kakao";
import { LABEL_READS_PER_DAY, labelReadConfigured, labelReadsToday, labelSearch } from "@/lib/label-read";
import { sameOrigin, userIdOf } from "@/lib/session-uid";

export const runtime = "nodejs";
export const maxDuration = 60;
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "허용되지 않은 요청" }, { status: 403, headers: NO_STORE });
  if (!labelReadConfigured()) return NextResponse.json({ error: "라벨 읽기가 잠시 꺼져 있어요. 이름으로 검색해 주세요." }, { status: 503, headers: NO_STORE });
  if (!rateLimit(req, 4, "label-read")) return NextResponse.json({ error: "잠시 뒤 다시 시도해 주세요." }, { status: 429, headers: NO_STORE });
  const c = checkMenuImages(await req.json().catch(() => null));
  if (!c.ok) return NextResponse.json({ error: c.error.replace("메뉴판", "라벨") }, { status: c.status, headers: NO_STORE });
  if ((await labelReadsToday().catch(() => 0)) >= LABEL_READS_PER_DAY) return NextResponse.json({ error: "오늘 라벨 읽기가 모두 쓰였어요. 이름으로 검색해 주세요." }, { status: 429, headers: NO_STORE });
  try {
    return NextResponse.json(await labelSearch(c.images[0], await userIdOf(req)), { headers: NO_STORE });
  } catch (e) {
    const m = menuReadError(e);
    return NextResponse.json({ error: m.error.replace("메뉴판", "라벨") }, { status: m.status, headers: NO_STORE });
  }
}
