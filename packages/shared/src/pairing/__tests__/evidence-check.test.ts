import { describe, expect, it } from "vitest";
import { evidenceFactor, isUnverifiableHost, judgeFetch, nextFailCount, quoteFound, readableUrl } from "../evidence-check";

const page = (body: string) => `<html><body>${"본문 ".repeat(120)}${body}</body></html>`;

describe("근거 검증(2026-09-27)", () => {
  it("인용문 대조 — 띄어쓰기·문장부호·말줄임 무시, 조각 절반 이상", () => {
    const t = page("<p>고소한 들기름에 매콤달콤한 <b>불닭 소스</b>를 더해 입맛을 살리는 불닭들기름 막국수</p>");
    expect(quoteFound("고소한 들기름에 매콤달콤한 불닭 소스를 더해 입맛을 살리는 불닭들기름 막국수", t)).toBe(true);
    expect(quoteFound("고소한 들기름에 매콤달콤한 불닭소스를 더해…", t)).toBe(true);
    expect(quoteFound("전혀 다른 문장으로 이루어진 인용문입니다 정말로", t)).toBe(false);
    expect(quoteFound("", t)).toBeNull();
    expect(quoteFound("파전", page("해물 파전"))).toBe(true);   // 짧은 인용은 통째로
  });
  it("판정", () => {
    const q = "파전과 잘 어울리는 막걸리";
    expect(judgeFetch({ url: "https://a.com/1", status: 200, text: page("파전과 잘 어울리는 막걸리"), quote: q }).status).toBe("ok");
    expect(judgeFetch({ url: "https://a.com/1", status: 200, text: page("다른 이야기"), quote: q }).status).toBe("quote_missing");
    expect(judgeFetch({ url: "https://a.com/1", status: 404, text: "", quote: q }).status).toBe("dead");
    expect(judgeFetch({ url: "https://a.com/1", status: null, text: "", quote: q }).status).toBe("dead");
    expect(judgeFetch({ url: "https://a.com/1", status: 403, text: "", quote: q }).status).toBe("blocked");
    expect(judgeFetch({ url: "https://a.com/1", status: 200, text: "<div id=app></div>", quote: q }).status).toBe("blocked");   // 스크립트 화면
    expect(judgeFetch({ url: "https://cafe.naver.com/x/1", status: 200, text: "", quote: q }).status).toBe("unverifiable");
    expect(judgeFetch({ url: "https://a.com/1", status: 200, text: page("아무 글"), quote: null })).toMatchObject({ status: "ok", quoteOk: null });
  });
  it("연속 실패와 무게 — 한 번은 봐주고 두 번째부터", () => {
    expect(nextFailCount(0, "dead")).toBe(1);
    expect(nextFailCount(1, "quote_missing")).toBe(2);
    expect(nextFailCount(3, "ok")).toBe(0);
    expect(nextFailCount(3, "blocked")).toBe(0);
    expect(evidenceFactor({ link_status: "dead", fail_count: 1 })).toBe(1);
    expect(evidenceFactor({ link_status: "dead", fail_count: 2 })).toBe(0);
    expect(evidenceFactor({ link_status: "quote_missing", fail_count: 2 })).toBe(0.5);
    expect(evidenceFactor({ link_status: "blocked", fail_count: 0 })).toBe(1);
    expect(evidenceFactor({})).toBe(1);
  });
  it("네이버 블로그는 모바일 주소로, 카페·공공데이터는 못 읽는 곳", () => {
    expect(readableUrl("https://blog.naver.com/kim/2233")).toBe("https://m.blog.naver.com/kim/2233");
    expect(readableUrl("https://blog.naver.com/PostView.naver?blogId=kim&logNo=2233")).toBe("https://m.blog.naver.com/kim/2233");
    expect(readableUrl("https://thesool.com/x")).toBe("https://thesool.com/x");
    expect(isUnverifiableHost("https://cafe.naver.com/abc/1")).toBe(true);
    expect(isUnverifiableHost("https://www.data.go.kr/data/1")).toBe(true);
    expect(isUnverifiableHost("https://thesool.com/x")).toBe(false);
  });
});
