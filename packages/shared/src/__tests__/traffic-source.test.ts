import { describe, expect, it } from "vitest";
import { inAppOf, trafficSource } from "../traffic-source";

describe("유입 경로 분류", () => {
  it("검색", () => {
    expect(trafficSource({ ref: "https://search.naver.com/search.naver?query=막걸리+안주" })).toEqual({ group: "search", label: "네이버" });
    expect(trafficSource({ ref: "https://m.search.naver.com/" })).toEqual({ group: "search", label: "네이버" });
    expect(trafficSource({ ref: "https://www.google.com/" })).toEqual({ group: "search", label: "구글" });
    expect(trafficSource({ ref: "https://www.google.co.kr/" }).label).toBe("구글");
    expect(trafficSource({ ref: "https://bing.com/" }).label).toBe("빙");
    expect(trafficSource({ ref: "https://search.daum.net/search?q=x" }).label).toBe("다음");
  });
  it("SNS·블로그 — 네이버 블로그·카페는 검색이 아니다", () => {
    expect(trafficSource({ ref: "https://blog.naver.com/someone/123" })).toEqual({ group: "sns", label: "네이버 블로그" });
    expect(trafficSource({ ref: "https://m.blog.naver.com/x" }).label).toBe("네이버 블로그");
    expect(trafficSource({ ref: "https://cafe.naver.com/x" }).label).toBe("네이버 카페");
    expect(trafficSource({ ref: "https://l.instagram.com/?u=x" })).toEqual({ group: "sns", label: "인스타그램" });
    expect(trafficSource({ ref: "https://t.co/abc" }).label).toBe("X(트위터)");
    expect(trafficSource({ ref: "https://someone.tistory.com/1" }).label).toBe("티스토리");
  });
  it("우리 주소·로그인 왕복은 유입이 아니다", () => {
    for (const ref of ["https://pairinggo.kr/drinks", "https://www.pairinggo.kr/", "https://pairinggo.com/", "https://pairinggo.vercel.app/x", "http://localhost:3000/", "https://nid.naver.com/oauth2.0/authorize", "https://kauth.kakao.com/x", "https://accounts.google.com/x"])
      expect(trafficSource({ ref }).group).toBe("internal");
  });
  it("직전 주소가 없으면 직접 — 앱 안 브라우저면 그 앱", () => {
    expect(trafficSource({ ref: "" })).toEqual({ group: "direct", label: "직접·알 수 없음" });
    expect(trafficSource({})).toMatchObject({ group: "direct" });
    expect(trafficSource({ ref: "", via: "kakaotalk" })).toEqual({ group: "sns", label: "카카오톡 앱 안" });
    expect(trafficSource({ via: "instagram" }).label).toBe("인스타그램 앱 안");
  });
  it("utm_source가 가장 먼저", () => {
    expect(trafficSource({ ref: "https://l.instagram.com/", q: "?utm_source=sns" })).toEqual({ group: "sns", label: "SNS 글(우리 글 복사)" });
    expect(trafficSource({ q: "?d=d1&utm_source=kakao" })).toEqual({ group: "share", label: "카카오톡 공유" });
    expect(trafficSource({ q: "?utm_source=share", ref: "" }).label).toBe("공유 버튼");
    expect(trafficSource({ q: "?utm_source=Newsletter%20A" })).toEqual({ group: "share", label: "공유 링크(newslettera)" });
    expect(trafficSource({ q: "?q=utm_source" }).group).toBe("direct");
  });
  it("그 밖의 사이트는 주소 이름으로", () => {
    expect(trafficSource({ ref: "https://www.thesool.com/front/x" })).toEqual({ group: "site", label: "thesool.com" });
    expect(trafficSource({ ref: "not a url" }).group).toBe("direct");
  });
  it("앱 안 브라우저 알아내기", () => {
    expect(inAppOf("Mozilla/5.0 (iPhone) AppleWebKit Mobile KAKAOTALK 10.5.0")).toBe("kakaotalk");
    expect(inAppOf("Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile Safari Instagram 330.0")).toBe("instagram");
    expect(inAppOf("Mozilla/5.0 (iPhone) NAVER(inapp; search; 2000; 12.8.1)")).toBe("naver");
    expect(inAppOf("Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/450.0]")).toBe("facebook");
    expect(inAppOf("Mozilla/5.0 (Windows NT 10.0) Chrome/126 Safari/537.36")).toBe("");
  });
});

describe("푸시 유입(2026-10-02)", async () => {
  const { trafficSource } = await import("../traffic-source");
  it("utm_source=push → 푸시 알림", () => { expect(trafficSource({ q: "?d=d31&utm_source=push" })).toEqual({ group: "push", label: "푸시 알림" }); });
});
