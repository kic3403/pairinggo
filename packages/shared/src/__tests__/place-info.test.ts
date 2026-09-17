import { describe, expect, it } from "vitest";
import { cleanPlaceInfo, isEmptyPlaceInfo, placeChips, placeNoteLine, verifiedFirst, verifiedLabel, PLACE_NOTE_MAX } from "../place-info";

const known = { drinks: new Set(["d11", "d45"]), foods: new Set(["f08"]) };

describe("운영자 식당 정보 — 입력 정리", () => {
  it("모르는 값은 버리고, 카탈로그에 없는 id·중복은 뺀다", () => {
    const i = cleanPlaceInfo({ parking: "garage", corkage: "yes", room: "maybe", drinks: ["d11", "d11", "d999", "f08", "x"], foods: ["f08", "d11"], verifiedAt: "2026-9-1", source: "hacker" }, known);
    expect(i).toMatchObject({ parking: null, corkage: "yes", room: null, drinks: ["d11"], foods: ["f08"], verifiedAt: null, source: "operator" });
  });
  it("메모는 공백을 정리하고 길이를 자른다", () => {
    const i = cleanPlaceInfo({ corkageNote: "  병당   1만원  ", roomNote: "가".repeat(100) });
    expect(i.corkageNote).toBe("병당 1만원");
    expect(i.roomNote).toHaveLength(PLACE_NOTE_MAX);
  });
  it("아무것도 안 적으면 빈 입력", () => {
    expect(isEmptyPlaceInfo(cleanPlaceInfo({}))).toBe(true);
    expect(isEmptyPlaceInfo(cleanPlaceInfo({ room: "no" }))).toBe(false);
    expect(isEmptyPlaceInfo(cleanPlaceInfo({ drinks: ["d11"] }, known))).toBe(false);
  });
});

describe("식당 이름 옆 칩", () => {
  const info = cleanPlaceInfo({ parking: "paid", corkage: "yes", room: "no", corkageNote: "병당 1만원", verifiedAt: "2026-09-17" });
  it("운영자 확인 값이 먼저, 주차는 구글 값을 덮는다", () => {
    const chips = placeChips(info, { parking: "free", groups: true, reservable: null });
    expect(chips.map((c) => c.label)).toEqual(["콜키지 가능", "룸 없음", "주차 유료", "단체 가능"]);
    expect(chips.map((c) => c.verified)).toEqual([true, true, true, false]);
    expect(chips.find((c) => c.key === "room")!.tone).toBe("no");
  });
  it("운영자 정보가 없으면 구글 값만, 둘 다 없으면 빈 목록", () => {
    expect(placeChips(null, { parking: "free", groups: null, reservable: true }).map((c) => c.label)).toEqual(["주차 무료", "예약 가능"]);
    expect(placeChips(null, null)).toEqual([]);
  });
  it("메모 줄과 확인 표시", () => {
    expect(placeNoteLine(info)).toBe("콜키지 병당 1만원");
    expect(placeNoteLine(cleanPlaceInfo({ room: "yes" }))).toBeNull();
    expect(verifiedLabel(info)).toBe("운영자 확인 2026.09");
    expect(verifiedLabel({ source: "partner", verifiedAt: null })).toBe("매장 제공");
  });
});

describe("확인된 식당 먼저", () => {
  it("확인된 식당을 앞으로 옮기되 나머지 순서는 그대로", () => {
    const info = cleanPlaceInfo({ corkage: "yes" });
    const got = verifiedFirst([{ id: "a" }, { id: "b", info }, { id: "c" }, { id: "d", info }]);
    expect(got.map((p) => p.id)).toEqual(["b", "d", "a", "c"]);
  });
});
