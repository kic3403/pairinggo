import { NextResponse } from "next/server";

/** CORS — ALLOWED_ORIGINS(쉼표 구분) 화이트리스트, 비어 있으면 모두 허용 (공개 읽기 API + 익명 이벤트 수집) */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin) || allowed.includes("*");
  return {
    "Access-Control-Allow-Origin": ok ? (origin || "*") : allowed[0],
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,If-None-Match",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(body, { status: init.status ?? 200, headers: { ...corsHeaders(req), ...(init.headers || {}) } });
}
export function error(req: Request, status: number, message: string, extra?: Record<string, unknown>) {
  return json(req, { error: message, ...extra }, { status });
}
export function preflight(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** 공개 GET 캐시: CDN 5분, 만료 후 1시간 stale 허용 */
export const PUBLIC_CACHE = { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" };
export const NO_CACHE = { "Cache-Control": "no-store" };
