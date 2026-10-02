import { describe, expect, it } from "vitest";
import { addListItem, mergeMenuRead, cleanContactPhone, cleanNames, cleanNaverUrl, cleanPlaceInfo, isEmptyPlaceInfo, placeChips, placeNoteLine, verifiedFirst, verifiedLabel, PLACE_NOTE_MAX } from "../place-info";

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

describe("술·메뉴 추가 버튼", () => {
  const catalog = [{ id: "d11", name: "한산소곡주" }, { id: "d45", name: "계룡백일주" }];
  it("카탈로그 이름과 같으면(띄어쓰기 무시) id로, 아니면 적은 이름 그대로", () => {
    const a = addListItem({ ids: [], names: [] }, "한산 소곡주", catalog);
    expect(a).toEqual({ ids: ["d11"], names: [], added: true });
    const b = addListItem(a, "하우스 와인", catalog);
    expect(b).toEqual({ ids: ["d11"], names: ["하우스 와인"], added: true });
  });
  it("이미 있는 것·빈 입력은 넣지 않는다", () => {
    const base = { ids: ["d11"], names: ["하우스 와인"] };
    expect(addListItem(base, "한산소곡주", catalog).added).toBe(false);
    expect(addListItem(base, "하우스  와인", catalog).added).toBe(false);
    expect(addListItem(base, "   ", catalog).added).toBe(false);
  });
  it("직접 적은 이름은 30자·중복 제거·링크 금지", () => {
    expect(cleanNames(["  참이슬 ", "참이슬", "https://x.com 술", "가".repeat(50)])).toEqual(["참이슬", "가".repeat(30)]);
    const i = cleanPlaceInfo({ drinkNames: ["하우스 와인"], menuNames: ["모둠전", "모둠전"] });
    expect(i.drinkNames).toEqual(["하우스 와인"]);
    expect(i.menuNames).toEqual(["모둠전"]);
    expect(isEmptyPlaceInfo(i)).toBe(false);
  });
});

describe("메뉴판 사진 읽기 결과 합치기", () => {
  const catalog = { drinks: [{ id: "d11", name: "한산소곡주" }, { id: "d45", name: "계룡백일주" }], foods: [{ id: "f08", name: "해물파전" }] };
  const empty = { drinks: { ids: [], names: [] }, foods: { ids: [], names: [] } };
  it("카탈로그와 같다고 본 것은 연결, 아닌 것은 메뉴판 이름 그대로", () => {
    const r = mergeMenuRead(empty, [
      { kind: "food", name: "해물 파전(大)", catalogName: "해물파전" },
      { kind: "food", name: "모둠전", catalogName: null },
      { kind: "drink", name: "소곡주 750ml", catalogName: "한산소곡주" },
      { kind: "drink", name: "참이슬", catalogName: null },
    ], catalog);
    expect(r.foods).toEqual({ ids: ["f08"], names: ["모둠전"] });
    expect(r.drinks).toEqual({ ids: ["d11"], names: ["참이슬"] });
    expect([r.added, r.linked, r.skipped]).toEqual([4, 2, 0]);
  });
  it("카탈로그에 없는 이름을 지어내면 연결하지 않고, 이미 있는 것은 건너뛴다", () => {
    const current = { drinks: { ids: ["d11"], names: [] }, foods: { ids: [], names: ["모둠전"] } };
    const r = mergeMenuRead(current, [
      { kind: "drink", name: "소곡주", catalogName: "한산소곡주" },
      { kind: "drink", name: "대강 막걸리", catalogName: "없는막걸리" },
      { kind: "food", name: "모둠 전", catalogName: null },
      { kind: "food", name: "  ", catalogName: null },
    ], catalog);
    expect(r.drinks).toEqual({ ids: ["d11"], names: ["대강 막걸리"] });
    expect(r.foods.names).toEqual(["모둠전"]);
    expect([r.added, r.linked, r.skipped]).toEqual([1, 0, 3]);
  });
});

describe("네이버 링크·대표 번호", () => {
  it("네이버 주소(https)만 받는다", () => {
    expect(cleanNaverUrl("https://naver.me/abc123")).toBe("https://naver.me/abc123");
    expect(cleanNaverUrl("https://map.naver.com/p/entry/place/12345")).toBe("https://map.naver.com/p/entry/place/12345");
    expect(cleanNaverUrl("http://map.naver.com/p/1")).toBeNull();
    expect(cleanNaverUrl("https://evil-naver.com/x")).toBeNull();
    expect(cleanNaverUrl("https://example.com/naver.com")).toBeNull();
    expect(cleanNaverUrl("javascript:alert(1)")).toBeNull();
    expect(cleanNaverUrl("")).toBeNull();
    expect(cleanPlaceInfo({ corkage: "yes", naverUrl: "https://naver.me/abc" }).naverUrl).toBe("https://naver.me/abc");
  });
  it("대표 번호는 숫자·하이픈만 — 공개 정보(PlaceInfo)에는 들어가지 않는다", () => {
    expect(cleanContactPhone(" 042-123-4567 (점장) ")).toBe("042-123-4567");
    expect(Object.keys(cleanPlaceInfo({ contactPhone: "010-1234-5678" }))).not.toContain("contactPhone");
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

describe("파트너 저장 — 정보 화면과 판매 화면을 따로", async () => {
  const { cleanPlaceInfo, storePartInput } = await import("../place-info");
  const before = cleanPlaceInfo({
    parking: "free", parkingNote: "건물 뒤 5대", corkage: "yes", corkageNote: "병당 1만원", menuNote: "한우 수육과 막걸리", naverUrl: "https://naver.me/abc",
    photos: ["https://abc.supabase.co/storage/v1/object/public/menu-photos/m/a.jpg"],
    menuItems: [{ name: "수육", desc: "", price: 30000 }], drinkItems: [{ name: "한산소곡주", volume: "500ml", abv: 18, price: 20000 }], drinks: ["d1"], drinkNames: ["없는술"], source: "partner", verifiedAt: "2026-10-01",
  });
  it("정보만 저장 — 메뉴·술 표는 그대로", () => {
    const out = cleanPlaceInfo(storePartInput("info", before, { parking: "paid", parkingNote: "", menuNote: "새 소개", photos: [], menuItems: [], drinkItems: [] }));
    expect(out).toMatchObject({ parking: "paid", parkingNote: "", menuNote: "새 소개", photos: [] });
    expect(out.corkage).toBeNull();                      // 정보 화면이 안 보낸 정보 값은 비운다(양조장은 콜키지를 안 쓴다)
    expect(out.menuItems).toEqual(before.menuItems);     // 표를 빈 값으로 보내도 지워지지 않는다
    expect(out.drinkItems).toEqual(before.drinkItems);
    expect(out.drinks).toEqual(["d1"]); expect(out.drinkNames).toEqual(["없는술"]);
  });
  it("판매만 저장 — 소개·사진·편의 정보는 그대로", () => {
    const out = cleanPlaceInfo(storePartInput("menu", before, { menuItems: [{ name: "파전", desc: "", price: 15000 }], drinkItems: [], menuNote: "", photos: [], parking: "" }));
    expect(out.menuItems.map((m) => m.name)).toEqual(["파전"]);
    expect(out.drinkItems).toEqual([]);
    expect(out).toMatchObject({ parking: "free", parkingNote: "건물 뒤 5대", corkage: "yes", corkageNote: "병당 1만원", menuNote: "한우 수육과 막걸리", naverUrl: "https://naver.me/abc" });
    expect(out.photos).toEqual(before.photos);
  });
  it("처음 저장(저장된 값 없음)·예전 방식", () => {
    expect(cleanPlaceInfo(storePartInput("menu", null, { drinkItems: [{ name: "막걸리", volume: "", abv: null, price: null }], menuNote: "x" }))).toMatchObject({ menuNote: "", drinkItems: [{ name: "막걸리" }] });
    const raw = { menuNote: "a", menuItems: [] };
    expect(storePartInput(undefined, before, raw)).toBe(raw);
  });
});
