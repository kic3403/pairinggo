/**
 * 처리 못 한 서버 오류 기록(2026-09-19) — 라우트·서버 컴포넌트에서 던져진 오류를 server_errors(0026)에 모은다.
 * 어드민 /admin/errors(페어링GO)에서 본다. 노드 런타임에서만(DB 클라이언트가 노드 전용).
 */
export async function onRequestError(err: unknown, request: { path: string; method: string }, context: { routePath?: string; routeType?: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@pairinggo/server/errors");
  // 경로의 검색어(?q=)에 개인정보가 섞일 수 있어 쿼리는 빼고 남긴다
  await reportError("partner", context.routePath ?? request.path.split("?")[0], err, { method: request.method, path: request.path.split("?")[0], kind: context.routeType ?? null });
}
