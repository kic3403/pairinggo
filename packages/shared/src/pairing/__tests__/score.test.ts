import { describe, expect, it } from "vitest";
import { scorePairings, sortByTab, explainOverall, blogPart, pairingScore, pairingGrade, gradeOf, GRADE_CUT } from "../score";
import { confidenceOf, confidenceText, evidenceStats, sourceKey, strengthOf } from "../confidence";
import { DATA, byDrink, byFood, D, F } from "../../data";
import type { Pairing } from "../../types";

const mk = (over: Partial<Pairing>): Pairing => ({ d: "d01", f: "f01", es: 90, reason: "", blog: 100, src: "profile", pf: { s: 50, plus: [], minus: [] }, ...over });
const REF = Math.log1p(10000);
const official = (over: Partial<Pairing> = {}) => mk({ src: "official", ev: { source: "양조장", url: "https://brewery.example/a" }, evn: 1, evs: 1, ...over });

describe("근거 신뢰도(2026-09-27)", () => {
  it("독립 출처 — 같은 매체·같은 블로거·같은 언론사는 하나", () => {
    expect(sourceKey({ url: "https://thesool.com/a?x=1" }, "official")).toBe("thesool.com");
    expect(sourceKey({ url: "https://www.thesool.com/b" }, "official")).toBe("thesool.com");
    expect(sourceKey({ url: "https://blog.naver.com/kim/123" }, "blog")).toBe("blog.naver.com/kim");
    expect(sourceKey({ url: "https://m.blog.naver.com/Kim/456" }, "blog")).toBe("blog.naver.com/kim");
    expect(sourceKey({ url: "https://blog.naver.com/lee/1" }, "blog")).toBe("blog.naver.com/lee");
    expect(sourceKey({ url: "https://n.news.naver.com/mnews/article/023/0003" }, "media")).toBe("news:023");
    expect(sourceKey({ url: "https://www.youtube.com/watch?v=abc" }, "blog")).toBe("yt:abc");
    expect(sourceKey({ who: "히히", source: "회원 추천" }, "user")).toBe("user:히히");
    expect(sourceKey({ source: "한증류소 제공" }, "official")).toBe("src:한증류소 제공");
  });
  it("강도 — 같은 출처 두 줄은 한 번, 등급 무게를 더한다", () => {
    expect(evidenceStats([{ url: "https://thesool.com/a", tier: "official" }, { url: "https://thesool.com/b", tier: "official" }])).toEqual({ n: 1, e: 1 });
    // 대중 출처는 가장 센 하나만 온전히, 나머지는 절반 — 매체 0.6 + 블로그 0.15 + 블로그 0.15
    expect(evidenceStats([{ url: "https://news.example.com/x", tier: "media" }, { url: "https://blog.naver.com/a/1", tier: "blog" }, { url: "https://blog.naver.com/b/2", tier: "blog" }])).toEqual({ n: 3, e: 0.9 });
    // 판매처 큐레이션(술담화 등)은 매체라도 0.4
    expect(evidenceStats([{ url: "https://www.sooldamhwa.com/x", tier: "media" }])).toEqual({ n: 1, e: 0.4 });
    expect(evidenceStats([{ url: "https://www.sooldamhwa.com/x", tier: "official" }])).toEqual({ n: 1, e: 1 });   // 양조장 발언으로 검수된 인용은 그대로
    // 검증 — 2번 연속 죽은 링크는 세지 않고, 인용문이 2번 연속 없으면 절반
    expect(evidenceStats([{ url: "https://brew.com/1", tier: "official", link_status: "dead", fail_count: 2 }])).toEqual({ n: 0, e: 0 });
    expect(evidenceStats([{ url: "https://brew.com/1", tier: "official", link_status: "dead", fail_count: 1 }])).toEqual({ n: 1, e: 1 });
    expect(evidenceStats([{ url: "https://brew.com/1", tier: "official", link_status: "quote_missing", fail_count: 2 }])).toEqual({ n: 1, e: 0.5 });
    // 보도자료 하나를 옮겨 쓴 매체 3곳 + 양조장 공식 1 → 1 + 0.6 + 0.3 + 0.3
    expect(evidenceStats([{ url: "https://ziksir.com/1", tier: "official" }, { url: "https://theviewers.co.kr/2", tier: "media" }, { url: "https://eroun.net/3", tier: "media" }, { url: "https://ksilbo.co.kr/4", tier: "media" }])).toEqual({ n: 4, e: 2.2 });
    expect(evidenceStats([{ url: "https://a.com/1", tier: "media" }, { url: "https://b.com/2", tier: "media" }])).toEqual({ n: 2, e: 0.9 });   // 매체 2곳은 아직 근거 약함
    // 전문가는 각자 온전히 — 양조장 공식 + 소믈리에
    expect(evidenceStats([{ url: "https://brew.com/1", tier: "official" }, { who: "김소믈리에", source: "인터뷰", tier: "sommelier" }])).toEqual({ n: 2, e: 2 });
    // 같은 인용문은 한 출처
    expect(evidenceStats([{ url: "https://a.com/1", tier: "media", quote: "파전과 잘 어울린다고 했다." }, { url: "https://b.com/2", tier: "media", quote: "파전과 잘 어울린다고 했다" }])).toEqual({ n: 1, e: 0.6 });
    expect(evidenceStats([{ who: "a", tier: "user" }, { who: "b", tier: "user" }, { who: "a", tier: "user" }])).toEqual({ n: 2, e: 0.45 });
    expect(evidenceStats([], "profile")).toEqual({ n: 0, e: 0 });
    expect(evidenceStats([{ url: "https://x.com/1" }], "media")).toEqual({ n: 1, e: 0.6 });   // 줄에 등급이 없으면 조합 등급
  });
  it("신뢰도 3단계 — 옛 번들(evs 없음)은 대표 근거로 어림", () => {
    expect(confidenceOf(official())).toBe("confirmed");
    expect(confidenceOf(mk({ src: "media", evn: 1, evs: 0.6 }))).toBe("weak");
    expect(confidenceOf(mk({ src: "media", evn: 2, evs: 1.2 }))).toBe("confirmed");
    expect(confidenceOf(mk({ src: "profile" }))).toBe("estimate");
    expect(strengthOf(mk({ src: "blog", ev: { url: "https://b.com" } }))).toEqual({ n: 1, e: 0.3 });
    expect(confidenceText(mk({ src: "media", evn: 2, evs: 1.2 }))).toBe("근거 확인 · 출처 2곳");
    expect(confidenceText(mk({}))).toBe("추정");
  });
});

describe("등급 — 신뢰도가 먼저", () => {
  it("경계", () => {
    expect(pairingGrade(GRADE_CUT.best, "confirmed").key).toBe("best");
    expect(pairingGrade(GRADE_CUT.best - 1, "confirmed").key).toBe("good");
    expect(pairingGrade(0, "confirmed").key).toBe("good");            // 근거 확인은 적어도 잘 어울림
    expect(pairingGrade(GRADE_CUT.good, "weak").key).toBe("good");
    expect(pairingGrade(GRADE_CUT.good - 1, "weak").key).toBe("try");
    expect(pairingGrade(100, "weak").key).toBe("good");               // 근거 약함은 찰떡이 못 된다
    expect(pairingGrade(100, "estimate").key).toBe("try");            // 추정은 점수와 무관하게 시도해 볼 만
  });
  it("추정 조합은 어떤 값이어도 점수 40을 넘지 못하고(실데이터 최대 36) 늘 시도해 볼 만", () => {
    const p = mk({ es: 97, blog: 1e9, pf: { s: 100, plus: [], minus: [] } });
    expect(pairingScore(p, { blogRef: REF })).toBe(40);
    expect(gradeOf(p, { blogRef: REF }).key).toBe("try");
  });
  it("전문가 점수(es)는 더 이상 점수에 들어가지 않는다", () => {
    expect(pairingScore(mk({ es: 97 }))).toBe(pairingScore(mk({ es: 84 })));
  });
  it("등급은 편중 보정(−5) 전 점수로 매긴다", () => {
    const rows = [official({ f: "a1", blog: 5000 }), official({ f: "a2", blog: 5000 }), official({ f: "a3", blog: 5000 })];
    const s = scorePairings(rows, (p) => p.f[0], { blogRef: REF });
    const adj = s.find((x) => x.adjusted)!;
    expect(adj.overall).toBe(adj.base - 5);
    expect(adj.grade.key).toBe(pairingGrade(adj.base, adj.confidence).key);
  });
});

describe("순위", () => {
  it("근거 확인 > 근거 약함 > 추정 — 추정의 맛 분석·언급이 아무리 높아도", () => {
    const est = mk({ f: "e", blog: 1e6, pf: { s: 100, plus: [], minus: [] } });
    const weak = mk({ f: "w", src: "blog", ev: { url: "https://blog.naver.com/a/1" }, evn: 1, evs: 0.3, blog: 0, pf: { s: 0, plus: [], minus: [] } });
    const conf = official({ f: "c", blog: 0, pf: { s: 0, plus: [], minus: [] } });
    expect(scorePairings([est, weak, conf]).map((x) => x.p.f)).toEqual(["c", "w", "e"]);
  });
  it("같은 신뢰도 안에서는 출처가 많을수록 위", () => {
    const one = official({ f: "one" }), two = official({ f: "two", evn: 2, evs: 2 });
    expect(scorePairings([one, two])[0].p.f).toBe("two");
  });
  it("편중 보정: 상위 5에 같은 그룹 3개면 3번째부터 −5", () => {
    const rows = [official({ f: "a1", evs: 3, evn: 3 }), official({ f: "a2", evs: 2.5, evn: 3 }), official({ f: "a3", evs: 2, evn: 2 }), official({ f: "b1", evs: 1.5, evn: 2 }), official({ f: "a4" })];
    const s = scorePairings(rows, (p) => p.f[0]);
    expect(s.find((x) => x.p.f === "a3")!.adjusted).toBe(true);
    expect(s.find((x) => x.p.f === "a1")!.adjusted).toBe(false);
    expect(s.find((x) => x.p.f === "b1")!.adjusted).toBe(false);
  });
  it("탭 정렬 — 전문가 탭은 근거 강도, 대중 탭은 언급 수", () => {
    const rows = [official({ f: "e", evs: 2, evn: 2, blog: 1 }), mk({ f: "b", blog: 9999 })];
    const s = scorePairings(rows);
    expect(sortByTab(s, "expert")[0].p.f).toBe("e");
    expect(sortByTab(s, "public")[0].p.f).toBe("b");
  });
  it("툴팁 문구", () => {
    const s = scorePairings([official({ blog: 1445, evn: 2, evs: 2 })])[0];
    expect(explainOverall(s, "양조장 공식")).toContain("근거 확인 · 출처 2곳(양조장 공식)");
    expect(explainOverall(s, "양조장 공식")).toContain("언급 1,445건");
    expect(explainOverall(scorePairings([mk({})])[0], "맛 프로필")).toContain("추정(근거 글 없음)");
  });
  it("대중 언급 — 로그 눈금, 같은 자", () => {
    expect(blogPart(0, REF)).toBe(0);
    expect(blogPart(10000, REF)).toBe(1);
    expect(blogPart(100, REF)).toBeCloseTo(Math.log1p(100) / REF, 6);
  });
});

describe("실데이터", () => {
  it("모든 조합이 술 화면과 음식 화면에서 점수·등급·신뢰도가 같다", () => {
    const fromDrink = new Map<string, string>();
    for (const id of Object.keys(D)) for (const s of scorePairings(byDrink[id] || [], (p) => F[p.f].category)) fromDrink.set(`${s.p.d}|${s.p.f}`, `${s.base}|${s.grade.key}|${s.confidence}`);
    let n = 0;
    for (const id of Object.keys(F)) for (const s of scorePairings(byFood[id] || [], (p) => D[p.d].category)) { expect(fromDrink.get(`${s.p.d}|${s.p.f}`)).toBe(`${s.base}|${s.grade.key}|${s.confidence}`); n++; }
    expect(n).toBe(DATA.pairings.length);
  });
  it("맛 분석 추정은 하나도 찰떡·잘 어울림이 아니고, 양조장 공식·소믈리에는 모두 잘 어울림 이상", () => {
    for (const p of DATA.pairings) {
      const g = gradeOf(p).key;
      if (p.src === "profile" || p.src === "ai") expect(g).toBe("try");
      if (p.src === "official" || p.src === "sommelier") expect(g).not.toBe("try");
    }
  });
  it("어떤 화면에서도 신뢰도가 낮은 조합이 높은 조합 위에 오지 않는다", () => {
    const rank = { confirmed: 2, weak: 1, estimate: 0 } as const;
    for (const [list, g] of [[byDrink, (p: Pairing) => F[p.f].category], [byFood, (p: Pairing) => D[p.d].category]] as const) {
      for (const id of Object.keys(list)) {
        const s = scorePairings(list[id] || [], g);
        for (let i = 1; i < s.length; i++) if (s[i].grade.key === s[i - 1].grade.key) expect(rank[s[i].confidence]).toBeLessThanOrEqual(rank[s[i - 1].confidence]);
      }
    }
  });
  it("점수는 0~100", () => {
    for (const p of DATA.pairings) { const x = pairingScore(p); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(100); }
  });
});
