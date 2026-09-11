import { describe, expect, it } from "vitest";
import { isDrinkMention, scoreMentions, trendNote, type MentionRow } from "../trend";

describe("isDrinkMention — 요일·사람 이름과 겹치는 글 거르기", () => {
  const hwayo = ["화요", "화요 41"];
  it("이름에 술 단어가 없으면 술 맥락 단어가 있어야 한다", () => {
    expect(isDrinkMention("화요일에 강릉 맛집 다녀왔어요", hwayo)).toBe(false);
    expect(isDrinkMention("추석 선물로 화요 41도 소주 한 병", hwayo)).toBe(true);
    expect(isDrinkMention("화요 시음기 — 도수 41", hwayo)).toBe(true);
  });
  it("이름에 술 단어가 있으면 그대로 언급으로 본다", () => {
    expect(isDrinkMention("복순도가 손막걸리 마셔봄", ["복순도가", "복순도가 손막걸리"])).toBe(true);
    expect(isDrinkMention("복 순도가 신상 치즈", ["복순도가", "복순도가 손막걸리"])).toBe(true);   // 띄어쓰기 무시
    expect(isDrinkMention("지평 막걸리 추천", ["지평막걸리", "지평생막걸리"])).toBe(true);
  });
  it("이름이 아예 없으면 아니다", () => {
    expect(isDrinkMention("전통주 추천 10선", hwayo)).toBe(false);
  });
});

const T = "2026-09-12";
const row = (drinkId: string, channel: MentionRow["channel"], count: number, day = T): MentionRow => ({ drinkId, channel, count, day });

describe("scoreMentions — 채널별 100점 정규화 후 평균", () => {
  it("예시: 인스타 100·네이버 50·구글 50·유튜브 50 → (100+50+50+50)/4 = 62.5점", () => {
    const rows = [
      row("seoul", "insta", 200), row("seoul", "naver", 50), row("seoul", "google", 25), row("seoul", "youtube", 10),
      row("other", "insta", 100), row("other", "naver", 100), row("other", "google", 50), row("other", "youtube", 20),
    ];
    const r = scoreMentions(rows, { today: T });
    expect(r.trend.seoul).toMatchObject({ insta: 100, naver: 50, google: 50, youtube: 50, score: 62.5, channels: 4 });
    expect(r.trend.other).toMatchObject({ insta: 50, naver: 100, google: 100, youtube: 100, score: 87.5, rank: 1 });
    expect(r.trend.seoul.rank).toBe(2);
  });

  it("언급 0건은 0점으로 평균에 들어가고, 세지 않은 채널은 null로 빠진다", () => {
    const rows = [row("a", "naver", 40), row("a", "youtube", 0), row("b", "naver", 20)];
    const r = scoreMentions(rows, { today: T });
    expect(r.trend.a).toMatchObject({ naver: 100, youtube: 0, insta: null, google: null, score: 50, channels: 2 });
    expect(r.trend.b).toMatchObject({ naver: 50, youtube: null, score: 50, channels: 1 });
    // 점수가 같으면 언급 총량이 많은 a가 위
    expect(r.trend.a.rank).toBe(1);
    expect(r.trend.b.rank).toBe(2);
  });

  it("술×채널별 가장 최근 기록만 쓰고, lookback 밖 기록은 버린다", () => {
    const rows = [row("a", "naver", 5, "2026-09-10"), row("a", "naver", 9, "2026-09-11"), row("a", "youtube", 99, "2026-08-01")];
    const r = scoreMentions(rows, { today: T, lookbackDays: 7 });
    expect(r.trend.a.raw?.naver).toBe(9);
    expect(r.trend.a.youtube).toBeNull();
    expect(r.trend.a.channels).toBe(1);
  });

  it("drinkIds를 주면 기록 없는 술도 결과에 들어가되 순위는 없다", () => {
    const r = scoreMentions([row("a", "naver", 3)], { today: T, drinkIds: ["a", "z"] });
    expect(r.trend.z).toMatchObject({ score: 0, channels: 0 });
    expect(r.trend.z.rank).toBeUndefined();
    expect(r.trend.a.rank).toBe(1);
  });

  it("채널 요약과 설명 문구", () => {
    const r = scoreMentions([row("a", "naver", 3), row("b", "youtube", 7)], { today: T });
    expect(r.channels.naver).toEqual({ max: 3, drinks: 1, top: "a" });
    expect(r.channels.insta.drinks).toBe(0);
    const note = trendNote(r, T);
    expect(note).toContain("유튜브·네이버 블로그");
    expect(note).not.toContain("인스타그램");
    expect(note).toContain("08/14~09/12");
  });
});
