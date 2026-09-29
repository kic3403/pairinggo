/**
 * 술·음식 상세 주소에 낱개 '%'가 섞이면 Next.js가 경로 값을 풀다 멈춰 500을 낸다("failed to decode param", 2026-09-29 확인 —
 * 예: 이름에 %가 있는 "금과명주 40%"를 주소창에 그대로 적으면 /drinks/금과명주-40%). 우리 코드에 닿기 전이라 페이지에서는 못 막는다.
 * 슬러그(toSlug)는 원래 기호를 지우므로, '%'를 빼고 같은 주소로 영구 이동시킨다. 정상 주소는 그대로 지나간다.
 */
import { NextResponse, type NextRequest } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const i = pathname.indexOf("/", 1);
  const raw = pathname.slice(i + 1);
  let once: string;
  try { once = decodeURIComponent(raw); } catch { once = raw; }
  if (!once.includes("%")) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `${pathname.slice(0, i)}/${encodeURIComponent(once.replace(/%/g, "").replace(/-{2,}/g, "-").replace(/^-|-$/g, ""))}`;
  return NextResponse.redirect(url, 308);
}

export const config = { matcher: ["/drinks/:slug", "/foods/:slug"] };
