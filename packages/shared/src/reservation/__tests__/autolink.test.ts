import { describe, expect, it } from "vitest";
import { isPlaceId, pickAutoLink } from "../partner";

const p = (id: string, name: string, road: string, addr = "") => ({ id, name, roadAddress: road, address: addr });

describe("직접 입력 매장 자동 연결(2026-09-27)", () => {
  it("도로명 주소가 같고 이름이 겹치는 장소가 하나면 그것", () => {
    const hit = pickAutoLink({ name: "명동 유록", address: "서울 중구 소공로46 남산플래티넘 쌍용아파트 상가 1층 118호" }, [
      p("1279892445", "유록", "서울 중구 소공로 46"), p("648074328", "유록장어", "전남 광주 서구 마륵벽진길 5"),
    ]);
    expect(hit?.id).toBe("1279892445");
  });
  it("주소는 같지만 이름이 안 겹치면 안 붙인다(같은 건물 다른 가게)", () => {
    expect(pickAutoLink({ name: "명동 유록", address: "서울 중구 소공로 46" }, [p("1", "스타벅스 소공점", "서울 중구 소공로 46")])).toBeNull();
  });
  it("후보가 둘이면 안 붙인다", () => {
    expect(pickAutoLink({ name: "유록", address: "서울 중구 소공로 46" }, [p("1", "유록", "서울 중구 소공로 46"), p("2", "유록 본점", "서울 중구 소공로 46")])).toBeNull();
  });
  it("도로명이 없고 지번만 있으면 지번으로도 본다", () => {
    expect(pickAutoLink({ name: "한증류소", address: "충남 서천군 한산면 지현리 100" }, [p("9", "농업회사법인 한증류소", "", "충남 서천군 한산면 지현리 100")])?.id).toBe("9");
  });
  it("장소 id 형식 — 카카오 숫자 또는 manual-", () => {
    expect(isPlaceId("1279892445")).toBe(true);
    expect(isPlaceId("manual-01958057a7de")).toBe(true);
    expect(isPlaceId("manual-x")).toBe(false);
    expect(isPlaceId("abc")).toBe(false);
  });
});
