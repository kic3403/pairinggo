import { getCatalog } from "@/lib/catalog";
import { error, json, preflight, PUBLIC_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/v1/foods/:id — 음식 상세 + 페어링(술 이름 포함) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCatalog();
  const f = c.dataset.foods.find((x) => x.id === id);
  if (!f) return error(req, 404, "음식을 찾을 수 없습니다");
  const drinks = new Map(c.dataset.drinks.map((d) => [d.id, d]));
  const pairings = c.dataset.pairings.filter((p) => p.f === id).map((p) => ({ ...p, drink: drinks.get(p.d) ? { id: p.d, name: drinks.get(p.d)!.name, category: drinks.get(p.d)!.category, abv: drinks.get(p.d)!.abv } : null }));
  return json(req, { version: c.version, food: f, pairings }, { headers: PUBLIC_CACHE });
}
export function OPTIONS(req: Request) { return preflight(req); }
