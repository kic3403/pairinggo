/**
 * 구조화 데이터(JSON-LD, docs/20 P3-4) — 검색 결과에 도수·가격·경로가 함께 보이게 한다.
 *
 * 규칙:
 *  · 값이 없는 항목은 키 자체를 넣지 않는다(빈 문자열·null을 내보내면 구글이 오류로 잡는다)
 *  · 주소는 모두 절대 주소로 바꾼다(검색엔진은 상대 경로를 못 읽는다)
 *  · 가격은 **입점 상품이 있을 때만** offers로 넣는다 — 없는 값을 지어내지 않는다
 *  · 스크립트에 넣기 전 `jsonLdScript()`로 감싼다(`</script>`가 태그를 닫아 버리는 것을 막는다)
 */

export type JsonLd = Record<string, unknown>;

/** 상대 경로를 절대 주소로 — 이미 http로 시작하면 그대로 */
export function absUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(path)) return path;
  return `${b}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** 값이 있는 것만 남긴다(빈 문자열·null·undefined·빈 배열 제외) */
function compact(o: JsonLd): JsonLd {
  const out: JsonLd = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === null || v === undefined || v === "") continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/**
 * <script type="application/ld+json">에 넣을 문자열.
 * `<`를 유니코드로 바꿔 본문에 섞인 `</script>`가 태그를 닫지 못하게 한다.
 */
export function jsonLdScript(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export type DrinkSeo = {
  name: string;
  desc?: string;
  category?: string;
  abv?: number | null;
  brewery?: string;
  region?: string;
  awards?: string[];
};

export type OfferSeo = {
  /** 파는 값(원) */
  price: number;
  /** 재고가 남았나 */
  inStock: boolean;
  /** 파는 곳 이름 — 우리는 중개자라 판매자를 밝힌다 */
  sellerName?: string;
};

/**
 * 술 상세 — Product. 도수는 additionalProperty로 싣는다(schema.org에 술 도수 전용 항목이 없다).
 * 파는 상품이 있으면 offers까지 붙어 검색 결과에 가격이 보일 수 있다.
 */
export function drinkProduct(d: DrinkSeo, opts: { base: string; path: string; offers?: OfferSeo[] }): JsonLd {
  const url = absUrl(opts.base, opts.path);
  const props: JsonLd[] = [];
  if (d.abv != null) props.push({ "@type": "PropertyValue", name: "도수", value: `${d.abv}%`, unitText: "% ABV" });
  if (d.category) props.push({ "@type": "PropertyValue", name: "종류", value: d.category });
  if (d.region) props.push({ "@type": "PropertyValue", name: "지역", value: d.region });

  const offers = (opts.offers ?? []).filter((o) => Number.isFinite(o.price) && o.price > 0);
  const best = offers.length ? offers.reduce((a, b) => (b.price < a.price ? b : a)) : null;

  return compact({
    "@context": "https://schema.org",
    "@type": "Product",
    name: d.name,
    description: d.desc,
    category: d.category,
    url,
    brand: d.brewery ? { "@type": "Brand", name: d.brewery } : undefined,
    additionalProperty: props,
    award: d.awards?.length ? d.awards : undefined,
    offers: best
      ? compact({
        "@type": "Offer",
        price: best.price,
        priceCurrency: "KRW",
        availability: best.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url,
        seller: best.sellerName ? { "@type": "Organization", name: best.sellerName } : undefined,
      })
      : undefined,
  });
}

/** 빵부스러기 — 검색 결과에 "홈 › 전통주 › 이름" 경로가 보인다 */
export function breadcrumb(items: { name: string; path: string }[], base: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absUrl(base, it.path) })),
  };
}

/** 목록 화면 — 어떤 항목이 몇 개 있는지 */
export function itemList(items: { name: string; path: string }[], opts: { base: string; name?: string }): JsonLd {
  return compact({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absUrl(opts.base, it.path) })),
  });
}

/** 홈 — 사이트 이름과 사이트 안 검색(검색 결과의 검색창) */
export function website(opts: { base: string; name: string; searchPath?: string }): JsonLd {
  const search = opts.searchPath ?? "/search?q={search_term_string}";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: opts.name,
    url: absUrl(opts.base, "/"),
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: absUrl(opts.base, search) },
      "query-input": "required name=search_term_string",
    },
  };
}
