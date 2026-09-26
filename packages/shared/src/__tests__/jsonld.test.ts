import { describe, expect, it } from "vitest";
import { absUrl, breadcrumb, drinkProduct, itemList, jsonLdScript, website } from "../seo/jsonld";

const BASE = "https://pairinggo.vercel.app";

describe("구조화 데이터 — 주소", () => {
  it("상대 경로를 절대 주소로", () => {
    expect(absUrl(BASE, "/drinks/한산소곡주")).toBe("https://pairinggo.vercel.app/drinks/한산소곡주");
    expect(absUrl(BASE + "/", "drinks")).toBe("https://pairinggo.vercel.app/drinks");
    expect(absUrl(BASE, "https://other.example/x")).toBe("https://other.example/x");
  });
});

describe("구조화 데이터 — 술(Product)", () => {
  const d = { name: "한산소곡주", desc: "백일 동안 빚는 약주", category: "약주", abv: 18, brewery: "한산소곡주", region: "충남 서천" };

  it("이름·설명·양조장·도수가 담긴다", () => {
    const ld = drinkProduct(d, { base: BASE, path: "/drinks/한산소곡주" }) as Record<string, any>;
    expect(ld["@type"]).toBe("Product");
    expect(ld.name).toBe("한산소곡주");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "한산소곡주" });
    expect(ld.url).toBe(`${BASE}/drinks/한산소곡주`);
    const abv = ld.additionalProperty.find((p: any) => p.name === "도수");
    expect(abv.value).toBe("18%");
  });

  it("빈 값은 키 자체를 넣지 않는다 — 구글이 오류로 잡지 않게", () => {
    const ld = drinkProduct({ name: "이름만" }, { base: BASE, path: "/drinks/이름만" }) as Record<string, any>;
    expect("brand" in ld).toBe(false);
    expect("description" in ld).toBe(false);
    expect("award" in ld).toBe(false);
    expect("offers" in ld).toBe(false);
    expect(ld.additionalProperty).toBeUndefined();
  });

  it("파는 상품이 있으면 가장 싼 값으로 offers를 붙인다", () => {
    const ld = drinkProduct(d, {
      base: BASE, path: "/drinks/한산소곡주",
      offers: [{ price: 30000, inStock: true, sellerName: "한증류소" }, { price: 25000, inStock: true, sellerName: "한증류소" }],
    }) as Record<string, any>;
    expect(ld.offers.price).toBe(25000);
    expect(ld.offers.priceCurrency).toBe("KRW");
    expect(ld.offers.availability).toBe("https://schema.org/InStock");
    expect(ld.offers.seller).toEqual({ "@type": "Organization", name: "한증류소" });
  });

  it("품절이면 OutOfStock, 값이 0 이하인 상품은 무시", () => {
    const ld = drinkProduct(d, { base: BASE, path: "/x", offers: [{ price: 0, inStock: true }, { price: 19000, inStock: false }] }) as Record<string, any>;
    expect(ld.offers.price).toBe(19000);
    expect(ld.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});

describe("구조화 데이터 — 경로·목록·사이트", () => {
  it("빵부스러기는 1번부터 번호를 매긴다", () => {
    const ld = breadcrumb([{ name: "홈", path: "/" }, { name: "전통주", path: "/drinks" }], BASE) as Record<string, any>;
    expect(ld.itemListElement[0]).toEqual({ "@type": "ListItem", position: 1, name: "홈", item: `${BASE}/` });
    expect(ld.itemListElement[1].position).toBe(2);
  });

  it("목록은 개수와 주소를 담는다", () => {
    const ld = itemList([{ name: "가", path: "/drinks/가" }], { base: BASE, name: "전통주" }) as Record<string, any>;
    expect(ld.numberOfItems).toBe(1);
    expect(ld.itemListElement[0].url).toBe(`${BASE}/drinks/가`);
    expect(ld.name).toBe("전통주");
  });

  it("홈에는 사이트 안 검색이 붙는다", () => {
    const ld = website({ base: BASE, name: "페어링GO" }) as Record<string, any>;
    expect(ld["@type"]).toBe("WebSite");
    expect(ld.potentialAction.target.urlTemplate).toContain("{search_term_string}");
  });
});

describe("구조화 데이터 — 스크립트에 안전하게", () => {
  it("</script>가 태그를 닫지 못하게 막는다", () => {
    const s = jsonLdScript({ name: "</script><img onerror=alert(1)>" });
    expect(s).not.toContain("</script>");
    expect(s).not.toContain("<");
    expect(s).not.toContain(">");
    // 그래도 원래 뜻은 살아 있다
    expect(JSON.parse(s.replace(/\\u003c/g, "<").replace(/\\u003e/g, ">").replace(/\\u0026/g, "&")).name).toBe("</script><img onerror=alert(1)>");
  });
});

describe("구조화 데이터 — 회원 평가(2026-09-26)", () => {
  it("3명 이상 평균이 있을 때만 aggregateRating", () => {
    const d = { name: "한산소곡주" };
    const a = drinkProduct(d, { base: BASE, path: "/drinks/x", rating: { avg: 4.3, count: 12 } }) as Record<string, any>;
    expect(a.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.3, reviewCount: 12, bestRating: 5, worstRating: 1 });
    expect("aggregateRating" in (drinkProduct(d, { base: BASE, path: "/drinks/x", rating: { avg: null, count: 2 } }) as Record<string, any>)).toBe(false);
    expect("aggregateRating" in (drinkProduct(d, { base: BASE, path: "/drinks/x" }) as Record<string, any>)).toBe(false);
  });
});

