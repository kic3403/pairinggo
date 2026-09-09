import { getCatalog } from "@/lib/catalog";
import { error, json, preflight, PUBLIC_CACHE } from "@/lib/http";

export const runtime = "nodejs";

/** GET /api/v1/drinks/:id — 술 상세 + 페어링(음식 이름 포함) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCatalog();
  const d = c.dataset.drinks.find((x) => x.id === id);
  if (!d) return error(req, 404, "술을 찾을 수 없습니다");
  const foods = new Map(c.dataset.foods.map((f) => [f.id, f]));
  const pairings = c.dataset.pairings.filter((p) => p.d === id).map((p) => ({ ...p, food: foods.get(p.f) ? { id: p.f, name: foods.get(p.f)!.name, category: foods.get(p.f)!.category } : null }));
  return json(req, { version: c.version, drink: d, pairings }, { headers: PUBLIC_CACHE });
}
export function OPTIONS(req: Request) { return preflight(req); }
