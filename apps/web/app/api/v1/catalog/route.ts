import { getCatalog } from "@/lib/catalog";
import { json, preflight, PUBLIC_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/v1/catalog — 미니앱 Dataset + version. ETag = version, If-None-Match → 304 */
export async function GET(req: Request) {
  const c = await getCatalog();
  const etag = `"${c.version}"`;
  const headers = { ...PUBLIC_CACHE, ETag: etag, "x-pairinggo-source": c.source };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ...headers, ...corsOnly(req) } });
  return json(req, { version: c.version, ...c.dataset }, { headers });
}
export function OPTIONS(req: Request) { return preflight(req); }

import { corsHeaders } from "@/lib/http";
function corsOnly(req: Request) { return corsHeaders(req); }
