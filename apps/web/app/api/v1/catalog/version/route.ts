import { getCatalog } from "@/lib/catalog";
import { json, preflight, PUBLIC_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/v1/catalog/version — {version, counts, source} (미니앱이 시작 시 비교) */
export async function GET(req: Request) {
  const c = await getCatalog();
  return json(req, { version: c.version, counts: c.counts, source: c.source }, { headers: { ...PUBLIC_CACHE, "x-pairinggo-source": c.source } });
}
export function OPTIONS(req: Request) { return preflight(req); }
