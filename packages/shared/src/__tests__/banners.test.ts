import { describe, expect, it } from "vitest";
import { DEFAULT_CARDS, activeBanners, bannerCards, cleanBanner, monthlyPartnerPick, periodText, reportCard, type BannerRow, type PartnerForBanner } from "../home/banners";

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

describe("이달의 파트너 — 등록한 카드가 없으면 달마다 한 곳 자동", () => {
  const photo = "https://abc.supabase.co/storage/v1/object/public/menu-photos/x/a.jpg";
  const P = (id: string, kind: PartnerForBanner["kind"], withPhoto = true): PartnerForBanner => ({ id, name: `매장${id}`, kind, kakaoId: `10${id.length}${id.charCodeAt(0)}`, photo: withPhoto ? photo : null });
  const list = [P("a", "brewery"), P("b", "brewery"), P("c", "brewery"), P("d", "restaurant"), P("e", "restaurant"), P("f", "restaurant"), P("g", "liquor")];
  const byId = Object.fromEntries(list.map((p) => [p.id, p]));

  it("같은 달이면 같은 매장, 목록 순서와 무관", () => {
    const a = monthlyPartnerPick(list, "restaurant", "2026-10");
    expect(a?.kind).toBe("restaurant");
    expect(monthlyPartnerPick([...list].reverse(), "restaurant", "2026-10")?.id).toBe(a?.id);
    expect(monthlyPartnerPick(list, "liquor", "2026-10")?.id).toBe("g");
    expect(monthlyPartnerPick([], "brewery", "2026-10")).toBeNull();
  });
  it("순번제 — 달마다 다음 매장, 매장 수만큼 지나면 한 바퀴", () => {
    const months = ["2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03"];
    const picks = months.map((m) => monthlyPartnerPick(list, "restaurant", m)?.id);
    expect(new Set(picks.slice(0, 3)).size).toBe(3);                 // 세 곳이 석 달 동안 한 번씩
    expect(picks.slice(3)).toEqual(picks.slice(0, 3));               // 넉 달째부터 같은 차례로 다시
    for (let i = 1; i < picks.length; i++) expect(picks[i]).not.toBe(picks[i - 1]);   // 연달아 같은 곳 없음
    expect(monthlyPartnerPick(list, "restaurant", "2026-12")?.id).not.toBe(monthlyPartnerPick(list, "restaurant", "2027-01")?.id);   // 해가 바뀌어도 이어진다
  });
  it("두 곳이면 번갈아, 사진이 없어도 차례가 온다", () => {
    const two = [P("a", "brewery", false), P("b", "brewery", true)];
    const seq = ["2026-10", "2026-11", "2026-12", "2027-01"].map((m) => monthlyPartnerPick(two, "brewery", m)?.id);
    expect(seq[0]).not.toBe(seq[1]); expect(seq[2]).toBe(seq[0]); expect(seq[3]).toBe(seq[1]);
    expect(seq).toContain("a");
  });
  it("카드: 등록이 없으면 양조장·식당 자동 카드, 리쿼샵은 자동 없음", () => {
    const cards = bannerCards([], "2026-10-01", byId);
    expect(cards.map((c) => c.id)).toEqual(["report", "auto-brewery", "auto-restaurant"]);
    expect(cards[1]).toMatchObject({ kind: "partner", badge: "이달의 파트너 양조장", tone: "sand", period: null });
    expect(cards[2]).toMatchObject({ badge: "이달의 파트너 식당", cta: "매장 보기", tone: "mist" });
    expect(cards[1].title).toBe(monthlyPartnerPick(list, "brewery", "2026-10")?.name);
    expect(bannerCards([], "2026-10-31", byId)[2].title).toBe(cards[2].title);   // 그 달 내내 같다
  });
  it("카드: 이벤트·협업으로 등록한 업종은 등록한 매장만(자동은 다른 업종에만)", () => {
    const cards = bannerCards([row({ id: "p", kind: "partner", merchantId: "e", title: "", href: "", startsOn: "2026-10-01", endsOn: "2026-10-15" })], "2026-10-05", byId);
    expect(cards.map((c) => c.id)).toEqual(["report", "p", "auto-brewery"]);
    expect(cards[1]).toMatchObject({ title: "매장e", badge: "이달의 파트너 식당", period: "10/1(목) ~ 10/15(목)" });
    // 기간이 끝나면 다시 자동
    expect(bannerCards([row({ id: "p", kind: "partner", merchantId: "e", title: "", href: "", endsOn: "2026-10-15" })], "2026-10-16", byId).map((c) => c.id)).toEqual(["report", "auto-brewery", "auto-restaurant"]);
  });
});
