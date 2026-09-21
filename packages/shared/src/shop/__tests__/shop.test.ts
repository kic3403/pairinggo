import { describe, it, expect } from "vitest";
import {
  cleanCourier, cleanInvoice, trackUrl, cleanShippingPolicy, shippingFee, freeShipGap, shippingLabel, DEFAULT_SHIPPING,
  cleanProduct, productProblem, sellable, buyableQty, discountRate,
  summarizeCart, addToCartProblem, freeShipHint, type SellerInfo,
  canOrderTransition, cancelable, countsAsSale, cleanAddress, addressProblem, isIslandZip, isOrderNo, cleanReason,
  RETURN_DAYS, AUTO_DONE_DAYS,
  APP_FEE, APP_FEE_TRIAL, feeText, totalFee, feeAmounts,
} from "../index";

const DAY = 86_400_000;

describe("택배사", () => {
  it("목록에 있는 코드는 그 이름으로", () => {
    expect(cleanCourier("cj")).toEqual({ code: "cj", name: "CJ대한통운" });
    expect(cleanCourier("CJ")).toEqual({ code: "cj", name: "CJ대한통운" });
  });
  it("이름을 그대로 보내도 목록에서 찾는다", () => {
    expect(cleanCourier("CJ대한통운").code).toBe("cj");
    expect(cleanCourier("etc", "우체국택배").code).toBe("epost");
  });
  it("목록에 없으면 직접 입력으로 남는다", () => {
    expect(cleanCourier("etc", "우리동네택배")).toEqual({ code: "etc", name: "우리동네택배" });
  });
  it("링크가 섞인 이름·빈 값은 받지 않는다", () => {
    expect(cleanCourier("etc", "https://택배.com")).toEqual({ code: "", name: "" });
    expect(cleanCourier("", "")).toEqual({ code: "", name: "" });
  });
  it("송장번호는 숫자만 8~30자", () => {
    expect(cleanInvoice("1234-5678-9012")).toBe("123456789012");
    expect(cleanInvoice("123")).toBe("");
    expect(cleanInvoice("12345678ab")).toBe("");
  });
  it("조회 링크는 목록에 있고 조회 주소가 있는 택배사만", () => {
    expect(trackUrl(cleanCourier("cj"), "123456789012")).toContain("123456789012");
    expect(trackUrl(cleanCourier("etc", "우리동네택배"), "123456789012")).toBeNull();
    expect(trackUrl(cleanCourier("daesin"), "123456789012")).toBeNull(); // 조회 주소 없음
    expect(trackUrl(cleanCourier("cj"), "짧음")).toBeNull();
  });
});

describe("배송비", () => {
  const policy = cleanShippingPolicy({ fee: 3000, freeOver: 30000, islandFee: 3000, leadDays: 2, cold: true, courierCode: "cj" });

  it("양조장이 적은 값을 정리한다", () => {
    expect(policy).toMatchObject({ fee: 3000, freeOver: 30000, islandFee: 3000, leadDays: 2, cold: true });
    expect(policy.courier.name).toBe("CJ대한통운");
  });
  it("빈 값·이상한 값은 기본값으로", () => {
    const p = cleanShippingPolicy({});
    expect(p).toMatchObject({ fee: 0, freeOver: 0, islandFee: 0, leadDays: DEFAULT_SHIPPING.leadDays, cold: false });
    expect(cleanShippingPolicy({ fee: -100, leadDays: 999 })).toMatchObject({ fee: 0, leadDays: 14 });
    expect(cleanShippingPolicy({ fee: "3,000원" }).fee).toBe(3000);
  });
  it("기본 배송비가 0이면 무료배송", () => {
    const free = cleanShippingPolicy({ fee: 0 });
    expect(shippingFee(free, { itemsTotal: 1000 })).toBe(0);
    expect(shippingLabel(free)).toBe("무료배송");
  });
  it("무료 기준을 넘으면 0원", () => {
    expect(shippingFee(policy, { itemsTotal: 29000 })).toBe(3000);
    expect(shippingFee(policy, { itemsTotal: 30000 })).toBe(0);
  });
  it("무료배송 상품이 담기면 0원", () => {
    expect(shippingFee(policy, { itemsTotal: 10000, freeShip: true })).toBe(0);
  });
  it("도서산간 추가비는 무료배송이어도 붙는다", () => {
    expect(shippingFee(policy, { itemsTotal: 50000, island: true })).toBe(3000);
    expect(shippingFee(policy, { itemsTotal: 10000, island: true })).toBe(6000);
  });
  it("무료까지 남은 금액", () => {
    expect(freeShipGap(policy, 22000)).toBe(8000);
    expect(freeShipGap(policy, 30000)).toBe(0);
    expect(freeShipGap(cleanShippingPolicy({ fee: 3000 }), 0)).toBe(0); // 기준 없음
  });
  it("안내 문구", () => {
    expect(shippingLabel(policy)).toBe("배송비 3,000원 · 30,000원 이상 무료");
  });
});

describe("상품", () => {
  const ok = { drinkExists: true, onlineSellable: true, sellerCold: true };
  const base = cleanProduct({ drinkId: "d1", name: "한산소곡주 500ml", volume: "500ML", abv: "18도", price: "25,000원", listPrice: 28000, stock: 10, perOrder: 2 });

  it("값을 정리한다", () => {
    expect(base).toMatchObject({ volume: "500ml", abv: 18, price: 25000, listPrice: 28000, stock: 10, perOrder: 2, status: "selling" });
  });
  it("카탈로그에 없는 술·온라인 판매 불가 술은 막는다", () => {
    expect(productProblem(base, { ...ok, drinkExists: false })).toMatch("페어링GO에 있는");
    expect(productProblem(base, { ...ok, onlineSellable: false })).toMatch("온라인으로 팔 수 없는");
  });
  it("냉장 배송을 못 하면 냉장 상품을 못 올린다", () => {
    const cold = cleanProduct({ ...base, cold: true });
    expect(productProblem(cold, { ...ok, sellerCold: false })).toMatch("냉장 배송을 켠 뒤에");
    expect(productProblem(cold, ok)).toBeNull();
  });
  it("가격·정가·링크를 검사한다", () => {
    expect(productProblem(cleanProduct({ ...base, price: 500 }), ok)).toMatch("가격을 적어");
    expect(productProblem(cleanProduct({ ...base, listPrice: 1000 }), ok)).toMatch("정가는");
    expect(productProblem(cleanProduct({ ...base, name: "소곡주 www.example.com" }), ok)).toMatch("링크");
    expect(productProblem(base, ok)).toBeNull();
  });
  it("재고·상한으로 살 수 있는 수량을 정한다", () => {
    expect(buyableQty({ stock: 10, perOrder: 2 })).toBe(2);
    expect(buyableQty({ stock: 1, perOrder: 5 })).toBe(1);
    expect(buyableQty({ stock: 7, perOrder: 0 })).toBe(7);
    expect(sellable({ status: "selling", stock: 0 })).toBe(false);
    expect(sellable({ status: "off", stock: 5 })).toBe(false);
  });
  it("할인율", () => {
    expect(discountRate({ price: 25000, listPrice: 28000 })).toBe(11);
    expect(discountRate({ price: 25000, listPrice: 0 })).toBe(0);
  });
});

describe("장바구니", () => {
  const sellers: SellerInfo[] = [
    { sellerId: "s1", name: "한증류소", shipping: cleanShippingPolicy({ fee: 3000, freeOver: 30000, islandFee: 3000 }) },
    { sellerId: "s2", name: "다른양조장", shipping: cleanShippingPolicy({ fee: 4000 }) },
  ];
  const line = (over: Partial<import("../cart").CartLine>) => ({ productId: "p", sellerId: "s1", name: "술", price: 10000, qty: 1, buyable: 10, ...over });

  it("양조장별로 묶고 배송비를 따로 붙인다", () => {
    const r = summarizeCart([line({ productId: "p1" }), line({ productId: "p2", qty: 2 }), line({ productId: "p3", sellerId: "s2" })], sellers);
    expect(r.groups).toHaveLength(2);
    const s1 = r.groups.find((g) => g.sellerId === "s1")!;
    expect(s1.itemsTotal).toBe(30000);
    expect(s1.shipFee).toBe(0); // 무료 기준 달성
    expect(r.groups.find((g) => g.sellerId === "s2")!.shipFee).toBe(4000);
    expect(r.itemsTotal).toBe(40000);
    expect(r.shipTotal).toBe(4000);
    expect(r.total).toBe(44000);
  });
  it("무료 기준은 그 양조장 금액으로만 따진다", () => {
    const r = summarizeCart([line({ productId: "p1", qty: 2 }), line({ productId: "p3", sellerId: "s2" })], sellers);
    expect(r.groups.find((g) => g.sellerId === "s1")!.shipFee).toBe(3000); // 20,000원 — 다른 양조장 금액과 합치지 않는다
  });
  it("무료배송 상품이 있으면 그 양조장 배송비는 0", () => {
    const r = summarizeCart([line({ shipFree: true })], sellers);
    expect(r.groups[0].shipFee).toBe(0);
    expect(freeShipHint(r.groups[0])).toBeNull();
  });
  it("품절·재고 초과는 빼고 계산한다", () => {
    const r = summarizeCart([line({ productId: "p1", buyable: 0 }), line({ productId: "p2", qty: 5, buyable: 2 }), line({ productId: "p3" })], sellers);
    expect(r.blocked).toHaveLength(2);
    expect(r.itemsTotal).toBe(10000);
  });
  it("도서산간이면 추가비가 붙는다", () => {
    const r = summarizeCart([line({})], sellers, { island: true });
    expect(r.groups[0].shipFee).toBe(6000);
  });
  it("무료까지 남은 금액을 안내한다", () => {
    const r = summarizeCart([line({ qty: 2 })], sellers);
    expect(freeShipHint(r.groups[0])).toBe("10,000원 더 담으면 무료배송");
  });
  it("담기 전에 막는 경우", () => {
    expect(addToCartProblem({ qty: 1, buyable: 0 }, { lines: 0, hasProduct: false })).toMatch("품절");
    expect(addToCartProblem({ qty: 3, buyable: 2 }, { lines: 0, hasProduct: false })).toMatch("최대 2개");
    expect(addToCartProblem({ qty: 1, buyable: 5 }, { lines: 30, hasProduct: false })).toMatch("30가지");
    expect(addToCartProblem({ qty: 1, buyable: 5 }, { lines: 30, hasProduct: true })).toBeNull();
  });
});

describe("주문 상태", () => {
  const now = Date.now();
  it("손님은 발송 전까지 취소할 수 있다", () => {
    expect(canOrderTransition("paid", "cancelled", "user")).toBe(true);
    expect(canOrderTransition("confirmed", "cancelled", "user")).toBe(true);
    expect(canOrderTransition("shipped", "cancelled", "user")).toBe(false);
    expect(cancelable("shipped")).toBe(false);
  });
  it("반품은 배송 완료 7일 안에만", () => {
    expect(canOrderTransition("delivered", "returned", "user", { now, deliveredAt: now - 3 * DAY })).toBe(true);
    expect(canOrderTransition("delivered", "returned", "user", { now, deliveredAt: now - (RETURN_DAYS + 1) * DAY })).toBe(false);
  });
  it("판매자는 확인·발송·배송완료·발송 전 취소", () => {
    expect(canOrderTransition("paid", "confirmed", "seller")).toBe(true);
    expect(canOrderTransition("confirmed", "shipped", "seller")).toBe(true);
    expect(canOrderTransition("shipped", "delivered", "seller")).toBe(true);
    expect(canOrderTransition("shipped", "cancelled", "seller")).toBe(false);
    expect(canOrderTransition("delivered", "done", "seller")).toBe(false);
  });
  it("시스템은 배송 완료 7일 뒤 자동 확정", () => {
    expect(canOrderTransition("delivered", "done", "system", { now, deliveredAt: now - (AUTO_DONE_DAYS + 1) * DAY })).toBe(true);
    expect(canOrderTransition("delivered", "done", "system", { now, deliveredAt: now - DAY })).toBe(false);
  });
  it("취소·반품은 매출에서 빠진다", () => {
    expect(countsAsSale("done")).toBe(true);
    expect(countsAsSale("cancelled")).toBe(false);
    expect(countsAsSale("returned")).toBe(false);
  });
});

describe("배송지", () => {
  const good = { name: "김동민", phone: "010-9414-7331", zip: "33643", addr1: "충남 서천군 한산면 충절로 1154", addr2: "1층", memo: "부재 시 경비실" };
  it("번호를 정리하고 빈 곳을 잡는다", () => {
    const a = cleanAddress(good);
    expect(a.phone).toBe("01094147331");
    expect(addressProblem(a)).toBeNull();
    expect(addressProblem(cleanAddress({ ...good, name: "김" }))).toMatch("이름");
    expect(addressProblem(cleanAddress({ ...good, phone: "123" }))).toMatch("휴대폰");
    expect(addressProblem(cleanAddress({ ...good, zip: "336" }))).toMatch("주소를 검색");
  });
  it("요청사항에 링크를 막는다", () => {
    expect(addressProblem(cleanAddress({ ...good, memo: "http://a.b 로 연락" }))).toMatch("링크");
  });
  it("제주·도서산간을 가린다", () => {
    expect(isIslandZip("63000")).toBe(true);
    expect(isIslandZip("40240")).toBe(true); // 울릉
    expect(isIslandZip("33643")).toBe(false);
    expect(isIslandZip("336")).toBe(false);
  });
  it("주문번호 형식", () => {
    expect(isOrderNo("260921AB12CD")).toBe(true);
    expect(isOrderNo("260921ab12cd")).toBe(true);
    expect(isOrderNo("26092112")).toBe(false);
  });
  it("취소 사유에서 링크를 지운다", () => {
    expect(cleanReason("재고가 없어요")).toBe("재고가 없어요");
    expect(cleanReason("www.여기로.com 연락")).toBe("");
  });
});

describe("수수료 — 앱·PG를 나눠 적는다", () => {
  it("시범 기간과 그 뒤", () => {
    expect(feeText(APP_FEE_TRIAL)).toBe("앱 수수료 0% + 결제수수료 2.5% = 2.5%");
    expect(feeText(APP_FEE)).toBe("앱 수수료 5% + 결제수수료 2.5% = 7.5%");
    expect(totalFee(APP_FEE)).toBe(7.5);
    expect(totalFee(APP_FEE_TRIAL)).toBe(2.5);
  });
  it("판매가에서 떼는 금액을 앱·PG로 나눈다(배송비 제외)", () => {
    const f = feeAmounts(50000, APP_FEE);
    expect(f).toEqual({ app: 2500, pg: 1250, total: 3750, payout: 46250 });
    expect(feeAmounts(50000, APP_FEE_TRIAL)).toEqual({ app: 0, pg: 1250, total: 1250, payout: 48750 });
  });
  it("이상한 값은 0으로 본다", () => {
    expect(feeAmounts(-100, -5, -1)).toEqual({ app: 0, pg: 0, total: 0, payout: 0 });
  });
});
