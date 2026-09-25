import { describe, expect, it } from "vitest";
import { DEFAULT_CARDS, activeBanners, bannerCards, cleanBanner, periodText, reportCard, type BannerRow } from "../home/banners";

const row = (over: Partial<BannerRow>): BannerRow => ({ id: "1", kind: "event", title: "추석 특집", subtitle: "", badge: "", cta: "보기", href: "/hot", tone: "navy", imageUrl: null, merchantId: null, startsOn: null, endsOn: null, sort: 0, active: true, ...over });

describe("홈 배너 규칙", () => {
  it("기간 안·켜진 카드만, sort → 끝이 가까운 순", () => {
    const rows = [
      row({ id: "a", startsOn: "2026-09-20", endsOn: "2026-09-30" }),
      row({ id: "b", startsOn: "2026-10-01" }),                 // 아직
      row({ id: "c", endsOn: "2026-09-24" }),                   // 끝남
      row({ id: "d", active: false }),
      row({ id: "e", endsOn: "2026-09-26" }),
      row({ id: "f", sort: -1 }),
    ];
    expect(activeBanners(rows, "2026-09-25").map((r) => r.id)).toEqual(["f", "e", "a"]);
  });
  it("정리: 제목 2자·사이트 안 링크·기간 순서·색·사진 주소", () => {
    expect(cleanBanner({ title: "가", href: "/x" }).problem).toBe("제목은 2자 이상");
    expect(cleanBanner({ title: "가을 이벤트", href: "https://evil.example" }).problem).toBe("링크는 사이트 안 주소(/로 시작)만");
    expect(cleanBanner({ title: "가을 이벤트", href: "/hot", startsOn: "2026-10-05", endsOn: "2026-10-01" }).problem).toBe("기간의 끝이 시작보다 앞입니다");
    const ok = cleanBanner({ title: "가을 이벤트", href: "/hot", tone: "pink", imageUrl: "https://x.com/a.jpg", startsOn: "2026.10.01", sort: "3" });
    expect(ok.problem).toBeNull(); expect(ok.row.tone).toBe("navy"); expect(ok.row.imageUrl).toBeNull(); expect(ok.row.startsOn).toBe("2026-10-01"); expect(ok.row.sort).toBe(3);
    expect(cleanBanner({ kind: "partner" }).problem).toBe("파트너 매장을 골라 주세요");
  });
  it("기간 문구", () => {
    expect(periodText("2026-09-14", "2026-09-27")).toBe("9/14(월) ~ 9/27(일)");
    expect(periodText(null, "2026-09-27")).toBe("9/27(일)까지");
    expect(periodText(null, null)).toBeNull();
  });
  it("카드 조립: 리포트가 맨 앞, 파트너 행은 매장 정보로, 부족하면 상시 카드", () => {
    const partners = { m1: { id: "m1", name: "한증류소", kind: "brewery" as const, kakaoId: "123", photo: "https://abc.supabase.co/storage/v1/object/public/menu-photos/m1/a.jpg" } };
    const cards = bannerCards([row({ id: "p", kind: "partner", merchantId: "m1", title: "", href: "" }), row({ id: "q", kind: "partner", merchantId: "없음" })], "2026-09-25", partners);
    expect(cards[0].id).toBe("report"); expect(cards[0].title).toBe("9월 트렌드 리포트");
    expect(cards[1]).toMatchObject({ kind: "partner", title: "한증류소", badge: "이달의 파트너 양조장", cta: "방문 시음 예약", href: "/places/123?n=%ED%95%9C%EC%A6%9D%EB%A5%98%EC%86%8C" });
    expect(cards.length).toBe(3); expect(cards[2].id).toBe(DEFAULT_CARDS[0].id);
    expect(reportCard("2026-12-03").title).toBe("12월 트렌드 리포트");
  });
});
