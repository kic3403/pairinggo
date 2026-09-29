import { describe, expect, it } from "vitest";
import { cleanNameIndex, nameIndexCounts, nameIndexOf } from "../name-index";

describe("목록 가나다 바로가기", () => {
  it("첫 글자 칸 — 된소리는 예사소리, 영문·숫자", () => {
    expect(nameIndexOf("가무치소주 25도")).toBe("ㄱ");
    expect(nameIndexOf("꽃잠")).toBe("ㄱ");
    expect(nameIndexOf("쌀막걸리")).toBe("ㅅ");
    expect(nameIndexOf("해창막걸리")).toBe("ㅎ");
    expect(nameIndexOf("S1974")).toBe("A-Z");
    expect(nameIndexOf("264 청포도 와인 꽃")).toBe("0-9");
    expect(nameIndexOf("1000억 유산균막걸리")).toBe("0-9");
    expect(nameIndexOf("‘달’")).toBe("ㄷ");
    expect(nameIndexOf("")).toBe("0-9");
  });
  it("URL 값·개수", () => {
    expect(cleanNameIndex("ㅂ")).toBe("ㅂ");
    expect(cleanNameIndex(["A-Z"])).toBe("A-Z");
    expect(cleanNameIndex("ㄲ")).toBeNull();
    expect(cleanNameIndex(undefined)).toBeNull();
    const c = nameIndexCounts(["가", "까", "나", "Z", "1"]);
    expect([c["ㄱ"], c["ㄴ"], c["A-Z"], c["0-9"], c["ㅎ"]]).toEqual([2, 1, 1, 1, 0]);
  });
});
