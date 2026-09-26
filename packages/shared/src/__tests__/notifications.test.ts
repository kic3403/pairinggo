import { describe, expect, it } from "vitest";
import { activeNotices, badgeText, cleanRecent, noticeProblem, pushRecent, timeAgo, unreadCount, type RecentItem } from "../notifications";

describe("최근 본(2026-09-26)", () => {
  it("맨 앞에 넣고, 같은 것은 하나만, 30개까지", () => {
    let list: RecentItem[] = [];
    for (let i = 0; i < 35; i++) list = pushRecent(list, { kind: "drink", id: `d${i}`, name: `술${i}`, href: `/drinks/${i}` }, i);
    expect(list).toHaveLength(30);
    expect(list[0].id).toBe("d34");
    list = pushRecent(list, { kind: "drink", id: "d20", name: "술20", href: "/drinks/20" }, 100);
    expect(list[0].id).toBe("d20");
    expect(list.filter((x) => x.id === "d20")).toHaveLength(1);
    expect(list).toHaveLength(30);
  });
  it("저장된 값 정리 — 모양이 어긋난 것은 버린다", () => {
    expect(cleanRecent(null)).toEqual([]);
    expect(cleanRecent([{ kind: "drink", id: "d1", name: "x", href: "/drinks/x", at: 1 }, { kind: "nope", id: "1", name: "y", href: "/y" }, { kind: "food", id: "f1", name: "z", href: "https://evil" }, { kind: "place", id: "p1", name: "w", href: "/places/p1" }]).map((x) => x.id)).toEqual(["d1", "p1"]);
  });
});

describe("공지·활동(2026-09-26)", () => {
  it("공지 검사", () => {
    expect(noticeProblem({ title: "추석 연휴 배송 안내", href: "/events" })).toBeNull();
    expect(noticeProblem({ title: "ㅇ" })).toMatch(/두 글자/);
    expect(noticeProblem({ title: "제목", href: "javascript:alert(1)" })).toMatch(/링크/);
    expect(noticeProblem({ title: "제목", href: "//evil.com" })).toMatch(/링크/);
    expect(noticeProblem({ title: "제목", kind: "spam" })).toMatch(/종류/);
    expect(noticeProblem({ title: "제목", startsOn: "2026-10-02", endsOn: "2026-10-01" })).toMatch(/시작일/);
  });
  it("보이는 공지 — 켜짐·기간 안, 최신순", () => {
    const rows = [
      { id: 1, kind: "notice", title: "옛날", body: "", href: "", starts_on: null, ends_on: "2026-09-01", active: true, created_at: "2026-08-01T00:00:00Z" },
      { id: 2, kind: "event", title: "지금", body: "", href: "", starts_on: "2026-09-20", ends_on: null, active: true, created_at: "2026-09-20T00:00:00Z" },
      { id: 3, kind: "notice", title: "꺼짐", body: "", href: "", starts_on: null, ends_on: null, active: false, created_at: "2026-09-25T00:00:00Z" },
      { id: 4, kind: "weird", title: "미래", body: "", href: "", starts_on: "2026-10-01", ends_on: null, active: true, created_at: "2026-09-26T00:00:00Z" },
      { id: 5, kind: "weird", title: "종류 모름", body: "", href: "", starts_on: null, ends_on: null, active: true, created_at: "2026-09-26T00:00:00Z" },
    ];
    const a = activeNotices(rows, "2026-09-26");
    expect(a.map((x) => x.id)).toEqual([5, 2]);
    expect(a[0].kind).toBe("notice");
  });
  it("읽지 않은 수·배지", () => {
    const items = [{ at: "2026-09-26T10:00:00Z" }, { at: "2026-09-26T12:00:00Z" }];
    expect(unreadCount(items, null)).toBe(2);
    expect(unreadCount(items, "2026-09-26T11:00:00Z")).toBe(1);
    expect(unreadCount(items, "2026-09-26T13:00:00Z")).toBe(0);
    expect(badgeText(3)).toBe("3"); expect(badgeText(120)).toBe("99+");
  });
  it("시간 표시", () => {
    const now = Date.parse("2026-09-26T12:00:00Z");
    expect(timeAgo("2026-09-26T11:59:40Z", now)).toBe("방금");
    expect(timeAgo("2026-09-26T11:30:00Z", now)).toBe("30분 전");
    expect(timeAgo("2026-09-26T08:00:00Z", now)).toBe("4시간 전");
    expect(timeAgo("2026-09-25T06:00:00Z", now)).toBe("어제");
    expect(timeAgo("2026-09-20T06:00:00Z", now)).toBe("9.20");
  });
});
