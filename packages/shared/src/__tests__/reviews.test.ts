import { describe, expect, it } from "vitest";
import { cleanReviewInput, cleanStorePhotos, normPlaceName, receiptDateOk, receiptKey, receiptMatchesPlace, receiptProblem, reviewStats, type ReceiptRead } from "../reviews";

const RP = "https://abcdefgh.supabase.co/storage/v1/object/public/review-photos/1f0c2a3b-aaaa-bbbb-cccc-1234567890ab/1789800000000-x7k2.jpg";
const MP = "https://abcdefgh.supabase.co/storage/v1/object/public/menu-photos/1f0c2a3b-aaaa-bbbb-cccc-1234567890ab/1789800000000-x7k2.jpg";

describe("리뷰 입력", () => {
  it("별점·글·사진 정리", () => {
    const r = cleanReviewInput({ rating: 5, body: "  수육이 부드럽고\r\n\r\n\r\n소곡주랑 잘 어울렸어요  ", photos: [RP, RP, "https://evil.example/x.jpg", MP] });
    expect(r).toEqual({ ok: true, value: { rating: 5, body: "수육이 부드럽고\n\n소곡주랑 잘 어울렸어요", photos: [RP] } });
  });
  it("별점 없음·짧은 글·링크·사진 초과는 막는다", () => {
    const bad = (x: object) => { const r = cleanReviewInput({ rating: 4, body: "충분히 긴 리뷰 글입니다", ...x }); return r.ok ? "" : r.problem; };
    expect(bad({ rating: 0 })).toContain("별점");
    expect(bad({ rating: 4.5 })).toContain("별점");
    expect(bad({ body: "맛있어요" })).toContain("10자");
    expect(bad({ body: "x".repeat(501) })).toContain("500자");
    expect(bad({ body: "여기 가세요 www.spam.com 할인" })).toContain("링크");
    expect(bad({ photos: Array.from({ length: 6 }, (_, i) => RP.replace("x7k2", `p${i}`)) })).toContain("5장");
  });
});

describe("대표 사진·평균", () => {
  it("메뉴 사진 저장소 주소만, 10장까지", () => {
    const many = Array.from({ length: 12 }, (_, i) => MP.replace("x7k2", `m${i}`));
    expect(cleanStorePhotos([...many, RP, "x"])).toHaveLength(10);
    expect(cleanStorePhotos([RP])).toEqual([]);
  });
  it("평균 별점 소수 한 자리", () => {
    expect(reviewStats([5, 4, 4])).toEqual({ count: 3, avg: 4.3 });
    expect(reviewStats([])).toEqual({ count: 0, avg: null });
  });
});

describe("영수증 인증", () => {
  const place = { name: "한산 소곡주 주점 둔산점", phone: "042-123-4567", bizNo: null };
  const R = (x: Partial<ReceiptRead> = {}): ReceiptRead => ({ isReceipt: true, storeName: "한산소곡주주점", bizNo: "", phone: "", address: "", date: "2026-09-18", time: "19:42", total: 58000, approvalNo: "30012345", ...x });
  it("상호 포함 관계·전화·사업자번호 중 하나만 맞으면 이 매장", () => {
    expect(normPlaceName("(주)한산 소곡주 주점 둔산점")).toBe("한산소곡주주점");
    expect(receiptMatchesPlace(R(), place)).toBe(true);
    expect(receiptMatchesPlace(R({ storeName: "주식회사 에이치에스에프앤비", phone: "0421234567" }), place)).toBe(true);
    expect(receiptMatchesPlace(R({ storeName: "다른 식당" }), place)).toBe(false);
    expect(receiptMatchesPlace(R({ storeName: "주" }), { name: "주" })).toBe(false);
  });
  it("최근 30일·미래 불가", () => {
    expect(receiptDateOk("2026-09-18", "2026-09-19")).toBe(true);
    expect(receiptDateOk("2026-08-20", "2026-09-19")).toBe(true);
    expect(receiptDateOk("2026-08-19", "2026-09-19")).toBe(false);
    expect(receiptDateOk("2026-09-20", "2026-09-19")).toBe(false);
    expect(receiptDateOk("9월 18일", "2026-09-19")).toBe(false);
  });
  it("안내 문구", () => {
    expect(receiptProblem(R(), place, "2026-09-19")).toBeNull();
    expect(receiptProblem(R({ isReceipt: false }), place, "2026-09-19")).toContain("영수증이 아닌");
    expect(receiptProblem(R({ storeName: "다른 식당" }), place, "2026-09-19")).toContain("이 매장");
    expect(receiptProblem(R({ date: "2026-07-01" }), place, "2026-09-19")).toContain("30일");
    expect(receiptProblem(R({ total: null, approvalNo: "" }), place, "2026-09-19")).toContain("금액");
  });
  it("같은 영수증은 같은 값 — 띄어쓰기·표기가 달라도", () => {
    expect(receiptKey(R())).toBe(receiptKey(R({ storeName: "한산 소곡주 주점", time: "19:42:10", approvalNo: "3001-2345" })));
    expect(receiptKey(R())).not.toBe(receiptKey(R({ total: 58001 })));
  });
});
