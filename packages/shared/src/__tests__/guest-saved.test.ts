import { describe, expect, it } from "vitest";
import { GUEST_SAVED_MAX, guestToMerge, parseGuestSaved, toggleGuestSaved } from "../guest-saved";

describe("비로그인 저장", () => {
  it("기기 글자 읽기 — 틀린 줄·중복 버림, 최근 것부터", () => {
    expect(parseGuestSaved(null)).toEqual([]);
    expect(parseGuestSaved("{")).toEqual([]);
    expect(parseGuestSaved('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([
      { kind: "drink", id: "d1", at: 1 },
      { kind: "wine", id: "x", at: 2 },
      { kind: "food", id: "", at: 3 },
      { kind: "food", id: "f1", at: 5 },
      { kind: "drink", id: "d1", at: 9 },
      { kind: "place", id: "123", at: 4, meta: { name: " 유록 ", evil: "x", url: 3 } },
      { kind: "drink", id: "d2", meta: { name: "술에는 meta 안 둠" } },
    ]);
    expect(parseGuestSaved(raw)).toEqual([
      { kind: "food", id: "f1", at: 5 },
      { kind: "place", id: "123", meta: { name: "유록" }, at: 4 },
      { kind: "drink", id: "d1", at: 1 },
      { kind: "drink", id: "d2", at: 0 },
    ]);
  });
  it("넣고 빼기", () => {
    const a = toggleGuestSaved([], "drink", "d1", undefined, 10);
    expect(a).toEqual({ saved: true, list: [{ kind: "drink", id: "d1", at: 10 }] });
    const b = toggleGuestSaved(a.list, "place", "p1", { name: "유록", address: "대전" }, 11);
    expect(b.list[0]).toEqual({ kind: "place", id: "p1", meta: { name: "유록", address: "대전" }, at: 11 });
    const c = toggleGuestSaved(b.list, "drink", "d1", undefined, 12);
    expect(c.saved).toBe(false);
    expect(c.list.map((x) => x.id)).toEqual(["p1"]);
  });
  it("최대 개수 — 오래된 것부터 빠짐", () => {
    let list = parseGuestSaved("[]");
    for (let i = 0; i < GUEST_SAVED_MAX + 3; i++) list = toggleGuestSaved(list, "drink", `d${i}`, undefined, i).list;
    expect(list).toHaveLength(GUEST_SAVED_MAX);
    expect(list[0].id).toBe(`d${GUEST_SAVED_MAX + 2}`);
    expect(list.some((x) => x.id === "d0")).toBe(false);
  });
  it("계정에 이미 있는 것은 옮기지 않음", () => {
    const list = toggleGuestSaved(toggleGuestSaved([], "drink", "d1", undefined, 1).list, "food", "f1", undefined, 2).list;
    expect(guestToMerge(list, new Set(["drink:d1"])).map((x) => x.id)).toEqual(["f1"]);
  });
  it("이름 — 목록 화면용", async () => {
    const { guestSavedName } = await import("../guest-saved");
    const a = toggleGuestSaved([], "drink", "d1", undefined, 1, " 한산소곡주 ").list;
    expect(a[0]).toEqual({ kind: "drink", id: "d1", name: "한산소곡주", at: 1 });
    expect(parseGuestSaved(JSON.stringify(a))).toEqual(a);
    expect(guestSavedName(a[0])).toBe("한산소곡주");
    expect(guestSavedName({ kind: "place", id: "1", meta: { name: "유록" }, at: 1 })).toBe("유록");
    expect(guestSavedName({ kind: "food", id: "f1", at: 1 })).toBe("");
  });
});
