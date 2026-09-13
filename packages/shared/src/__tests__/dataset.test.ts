import { afterEach, describe, expect, it } from "vitest";
import * as data from "../data";
import { DOCS } from "../search/docs";
import { search, intentSearch } from "../search";
import { CatalogResponseSchema, DatasetSchema, EventBatchSchema } from "../schemas";
import type { Dataset } from "../types";

const bundled = () => JSON.parse(JSON.stringify(data.DATA)) as Dataset;

describe("applyDataset (카탈로그 핫스왑)", () => {
  afterEach(() => data.resetDataset());

  it("기본은 번들", () => {
    expect(data.CATALOG_VERSION).toBe("bundled");
    expect(data.CATALOG_SOURCE).toBe("bundled");
  });
  it("새 데이터로 교체하면 인덱스·검색 문서·파생 목록이 갱신된다", () => {
    const ds = bundled();
    ds.drinks.push({ ...ds.drinks[0], id: "d999", name: "테스트양조 시험주", alias: "시험주", brewery: "테스트양조", region: "서울 마포", awards: [], trend: undefined });
    ds.pairings.push({ d: "d999", f: "f01", es: 90, reason: "시험", blog: 1, src: "profile" });
    data.applyDataset(ds, "2026-09-09T00:00:00Z");
    expect(data.CATALOG_VERSION).toBe("2026-09-09T00:00:00Z");
    expect(data.CATALOG_SOURCE).toBe("server");
    expect(data.D.d999?.name).toBe("테스트양조 시험주");
    expect(data.byDrink.d999).toHaveLength(1);
    expect(data.BREWERIES.some((b) => b.name === "테스트양조")).toBe(true);
    expect(DOCS.some((d) => d.id === "d999")).toBe(true);
    expect(search("시험주").hits[0]?.doc.id).toBe("d999");
    expect(intentSearch("마포 술 추천")?.drinks.some((r) => r.drink.id === "d999")).toBe(true);
  });
  it("되돌리면 번들로 복귀", () => {
    const ds = bundled(); ds.drinks = ds.drinks.slice(0, 50);
    data.applyDataset(ds, "v2");
    expect(data.DATA.drinks).toHaveLength(50);
    data.resetDataset();
    expect(data.DATA.drinks).toHaveLength(207);
    expect(data.CATALOG_VERSION).toBe("bundled");
    expect(search("복순도가").hits[0]?.doc.id).toBe("d01");
  });
  it("형식이 틀리면 거부하고 기존 데이터를 유지", () => {
    expect(() => data.applyDataset({ drinks: [], foods: [], pairings: [] } as unknown as Dataset, "x")).toThrow();
    expect(() => data.applyDataset({} as Dataset, "x")).toThrow();
    expect(data.DATA.drinks).toHaveLength(207);
  });
});

describe("zod 스키마", () => {
  it("번들 데이터는 DatasetSchema를 통과", () => {
    const r = DatasetSchema.safeParse(data.DATA);
    expect(r.success, JSON.stringify(r.success ? null : r.error.issues.slice(0, 3))).toBe(true);
  });
  it("CatalogResponse는 version 필수", () => {
    expect(CatalogResponseSchema.safeParse({ ...data.DATA }).success).toBe(false);
    expect(CatalogResponseSchema.safeParse({ ...data.DATA, version: "v1" }).success).toBe(true);
  });
  it("이벤트 배치: 개인정보 필드·잘못된 이름 거부", () => {
    expect(EventBatchSchema.safeParse({ events: [{ n: "search", p: { q: "육회" }, t: Date.now() }] }).success).toBe(true);
    expect(EventBatchSchema.safeParse({ events: [{ n: "search", p: { phone: "010" }, t: Date.now() }] }).success).toBe(false);
    expect(EventBatchSchema.safeParse({ events: [{ n: "screen", p: { path: "/drink/d01", sid: "x" }, t: Date.now() }] }).success).toBe(true);
    expect(EventBatchSchema.safeParse({ events: [{ n: "Search!", p: {}, t: Date.now() }] }).success).toBe(false);
    expect(EventBatchSchema.safeParse({ events: [] }).success).toBe(false);
  });
});
