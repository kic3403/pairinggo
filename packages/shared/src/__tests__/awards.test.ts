import { describe, expect, it } from "vitest";
import { awardLabel, matchAward, normalizePlaceName, type Award } from "../awards";

const A: Award[] = [
  { guide: "michelin", year: 2026, city: "서울", name: "밍글스", kind: "star", level: 3, lat: 37.52535, lng: 127.04426 },
  { guide: "michelin", year: 2026, city: "서울", name: "레스토랑 산", kind: "star", level: 1, lat: 37.52631, lng: 127.03391 },
  { guide: "michelin", year: 2026, city: "서울", name: "소울", kind: "star", level: 1, lat: 37.54533, lng: 126.98443 },
  { guide: "michelin", year: 2026, city: "서울", name: "우래옥", kind: "bib", level: 0, lat: 37.56815, lng: 126.99866 },
  { guide: "michelin", year: 2026, city: "서울", name: "개성만두 궁", kind: "bib", level: 0, lat: 37.57423, lng: 126.98539 },
];

describe("수상 배지 대조", () => {
  it("이름 정규화 — 띄어쓰기·괄호·접미사", () => {
    expect(normalizePlaceName("레스토랑 산")).toBe("산");
    expect(normalizePlaceName("밍글스 (Mingles)")).toBe("밍글스");
    expect(normalizePlaceName("우래옥 본점")).toBe("우래옥");
    expect(normalizePlaceName("개성만두 궁")).toBe("개성만두궁");
  });
  it("같은 이름 + 300m 안이면 배지, 멀면 없음", () => {
    expect(matchAward({ name: "우래옥", lat: 37.5682, lng: 126.9987 }, A)?.label).toBe("미쉐린 빕구르망 2026");
    expect(matchAward({ name: "우래옥 대치점", lat: 37.494, lng: 127.06 }, A)).toBeNull();
    expect(matchAward({ name: "밍글스", lat: 37.5253, lng: 127.0443 }, A)?.label).toBe("미쉐린 ★★★ 2026");
  });
  it("짧은 이름은 완전 일치 + 좌표가 있어야 붙는다 — '산'이 '산들바람'에 붙지 않는다", () => {
    expect(matchAward({ name: "산들바람 식당", lat: 37.5263, lng: 127.0339 }, A)).toBeNull();
    expect(matchAward({ name: "레스토랑 산", lat: 37.5263, lng: 127.0339 }, A)?.level).toBe(1);
    expect(matchAward({ name: "소울", lat: null, lng: null }, A)).toBeNull();
    expect(matchAward({ name: "소울", lat: 37.5453, lng: 126.9844 }, A)?.level).toBe(1);
  });
  it("좌표 없는 수상 행은 완전 일치일 때만", () => {
    const noCoord: Award[] = [{ guide: "michelin", year: 2026, city: "서울", name: "필동면옥", kind: "bib", level: 0 }];
    expect(matchAward({ name: "필동면옥", lat: 37.56, lng: 126.99 }, noCoord)?.kind).toBe("bib");
    expect(matchAward({ name: "필동면옥 강남점", lat: 37.5, lng: 127.03 }, noCoord)).toBeNull();
  });
  it("라벨에 연도가 붙는다", () => {
    expect(awardLabel({ guide: "michelin", kind: "star", level: 2, year: 2027 })).toBe("미쉐린 ★★ 2027");
    expect(awardLabel({ guide: "michelin", kind: "bib", level: 0, year: 2026 })).toBe("미쉐린 빕구르망 2026");
  });
});
