import { describe, expect, it } from "vitest";
import { cleanCatalogImage, cleanImageCredit } from "../catalog/images";
import { foodFromRow } from "../rows";

describe("카탈로그 사진 주소(2026-09-26)", () => {
  it("https 절대 주소와 사이트 안 경로만", () => {
    expect(cleanCatalogImage(" https://cdn.example.com/a/b.jpg ")).toBe("https://cdn.example.com/a/b.jpg");
    expect(cleanCatalogImage("/demo/d558.svg")).toBe("/demo/d558.svg");
    expect(cleanCatalogImage("http://x.com/a.jpg")).toBe("");        // 평문 http
    expect(cleanCatalogImage("//cdn.x.com/a.jpg")).toBe("");         // 프로토콜 생략
    expect(cleanCatalogImage("https://x.com")).toBe("");             // 경로 없음
    expect(cleanCatalogImage("https://x.com/a b.jpg")).toBe("");     // 공백
    expect(cleanCatalogImage('https://x.com/a".jpg')).toBe("");      // 따옴표
    expect(cleanCatalogImage("javascript:alert(1)")).toBe("");
    expect(cleanCatalogImage("https://x.com/" + "a".repeat(300))).toBe("");
    expect(cleanCatalogImage(null)).toBe("");
  });
  it("출처는 한 줄 80자", () => {
    expect(cleanImageCredit("  복순도가   제공 \n ")).toBe("복순도가 제공");
    expect(cleanImageCredit("가".repeat(100))).toHaveLength(80);
  });
  it("음식 행의 사진을 읽는다", () => {
    const f = foodFromRow({ id: "f1", name: "해물파전", category: "전", tags: [], image_url: "https://x.com/p.jpg", image_credit: "직접 촬영" });
    expect(f.image).toEqual({ url: "https://x.com/p.jpg", credit: "직접 촬영" });
    expect(foodFromRow({ id: "f2", name: "김치찌개", category: "찌개", tags: [] }).image).toBeNull();
  });
});
