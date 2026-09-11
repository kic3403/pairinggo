import { describe, expect, it } from "vitest";
import { hasBatchim, josa } from "../hangul";

describe("조사 붙이기", () => {
  it("받침 유무를 판별한다", () => {
    expect(hasBatchim("막걸리")).toBe(false);
    expect(hasBatchim("소주")).toBe(false);
    expect(hasBatchim("문배술")).toBe(true);
    expect(hasBatchim("이강주")).toBe(false);
    expect(hasBatchim("화요 41")).toBe(false);   // 숫자로 끝나면 받침 없음 취급
    expect(hasBatchim("오메기 맑은술")).toBe(true);
    expect(hasBatchim("감싸주는 날")).toBe(true);
  });
  it("과/와", () => {
    expect(josa("복순도가 손막걸리", "과/와")).toBe("복순도가 손막걸리와");
    expect(josa("문배술", "과/와")).toBe("문배술과");
    expect(josa("육회", "과/와")).toBe("육회와");
  });
  it("은/는 · 이/가 · 을/를 · 으로/로", () => {
    expect(josa("막걸리", "은/는")).toBe("막걸리는");
    expect(josa("증류주", "이/가")).toBe("증류주가");
    expect(josa("오메기술", "을/를")).toBe("오메기술을");
    expect(josa("파전", "으로/로")).toBe("파전으로");
    expect(josa("육회", "으로/로")).toBe("육회로");
  });
});
