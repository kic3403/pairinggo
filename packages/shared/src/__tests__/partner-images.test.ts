import { describe, expect, it } from "vitest";
import { partnerImages } from "../catalog/partner-images";
import { cleanDrinkItems } from "../menu-items";
import { categoryOptions, isKnownCategory } from "../catalog/kinds";

const IMG = (n: string) => `https://abc.supabase.co/storage/v1/object/public/menu-photos/m1/${n}.jpg`;
describe("파트너 술 사진 → 카탈로그 술 사진", () => {
  const drinks = [{ id: "d1", name: "한산소곡주", alias: ["소곡주"], brewery: "한산소곡주" }, { id: "d2", name: "복순도가 손막걸리", alias: ["복순도가"], brewery: "복순도가" }];
  it("이름(별칭·띄어쓰기 무시)이 같은 줄의 사진을 붙이고 출처는 매장 이름", () => {
    const m = partnerImages(drinks, [{ name: "우리집", brewery: null, items: [{ name: "복순도가", img: IMG("a") }, { name: "한산 소곡주", img: IMG("b") }, { name: "없는술", img: IMG("c") }] }]);
    expect(m.get("d2")).toEqual({ url: IMG("a"), credit: "우리집 제공" });
    expect(m.get("d1")?.url).toBe(IMG("b"));
    expect(m.size).toBe(2);
  });
  it("같은 술 사진이 여러 매장에 있으면 그 술을 빚은 양조장 파트너 것이 먼저", () => {
    const m = partnerImages(drinks, [
      { name: "식당A", brewery: null, items: [{ name: "한산소곡주", img: IMG("x") }] },
      { name: "한산소곡주 양조장", brewery: "한산소곡주", items: [{ name: "한산소곡주", img: IMG("y") }] },
      { name: "식당B", brewery: null, items: [{ name: "한산소곡주", img: IMG("z") }] },
    ]);
    expect(m.get("d1")).toEqual({ url: IMG("y"), credit: "한산소곡주 양조장 제공" });
  });
  it("사진 없는 줄은 무시", () => { expect(partnerImages(drinks, [{ name: "a", items: [{ name: "복순도가" }] }]).size).toBe(0); });
});
describe("술 표 종류", () => {
  it("아는 종류만 저장, 모르는 값은 버린다", () => {
    const rows = cleanDrinkItems([{ name: "a", volume: "", category: "탁주" }, { name: "b", volume: "", category: "싱글몰트" }, { name: "c", volume: "", category: "이상한값" }]);
    expect(rows.map((r) => r.category)).toEqual(["탁주", "싱글몰트", undefined]);
    expect(isKnownCategory("준마이 긴조")).toBe(true);
    expect(categoryOptions().find((g) => g.kind === "trad")?.options.map((o) => o.value)).toContain("허니와인");
  });
});
