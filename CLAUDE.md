# 페어링GO

술↔음식 양방향 페어링 추천 → (Stage 2) 전통주 앱 내 구매 → (Stage 3) 식당 자체 예약. 토스 앱인토스 미니앱이 주력.
기획·설계 문서는 docs/ (00~08). 작업 전 해당 Phase를 읽는다: docs/05_개발로드맵_Phase별.md
현재 Phase: **1 완료 (2026-09-09, docs/08 결과보고)** → 다음 **Phase 2** (Supabase 스키마·시드·공개 API). 서버·로그인·결제 아직 없음

## 구조 (pnpm workspaces)
- apps/miniapp      Vite + React 19 + TS + Tailwind v4 + react-router 7. @apps-in-toss/web-framework 3.x (apps-in-toss.config.ts, 테스트는 AIT Devtools 브라우저). **정적 번들만(SSR·서버 코드 금지)**. `pnpm --filter miniapp dev|build`
- packages/shared   @pairinggo/shared — 데이터(data/pairings.json)·타입·검색 엔진(search/)·페어링 점수(pairing/)·유사도·지역·별점. Vitest
- scripts/          check-links.mjs (주간 구매 링크 점검 → packages/shared/data/link-status.json)
- (Phase 2+) apps/web Next.js API·파트너 어드민, packages/db Supabase

## 절대 규칙
- 앱인토스 제약: 미니앱에 서버 코드·SSR 금지. 로그인은 토스 로그인만(Phase 3). 실물 결제는 토스페이만(Phase 5). 외부 결제창·외부 의존 링크 금지 — 예외는 법적 고지·제휴기관 공식 페이지·"제품 추천 후 구매 플랫폼 이동"(구매 버튼 문구: "양조장 공식몰로 이동").
- 외부 링크는 `apps/miniapp/src/lib/openExternal.ts`로만 연다(`<a target=_blank>` 직접 사용 금지).
- 비밀키 없음(Phase 1). 이후에도 미니앱 번들엔 KAKAO_JS_KEY·API_BASE_URL만.
- 온라인 판매 불가 주류(`NON_TRAD`, online_sellable=false)는 구매 링크 대신 "온라인 직배송 불가" 안내.
- 주류 경고문구·만 19세 안내는 전 페이지 공통 푸터. AI 생성 페어링은 `source: ai` 배지(Phase 9).
- 모든 UI 텍스트 한국어. 모바일 퍼스트 390px(최대 430px 중앙). 라이트·다크 모두 토큰으로.
- 검색·점수·유사도 로직은 packages/shared에만 두고 테스트를 먼저 쓴다. 컴포넌트에 계산 로직을 넣지 않는다.
- 커밋은 기능 단위로 작게. 커밋 메시지는 한국어 요약 + 영어 scope 허용.

## 데이터
- 원본: packages/shared/data/pairings.json (전통주 108 · 음식 110 · 페어링 851). 필드: drinks{id,name,alias,category,abv,region,brewery,desc,flavor[],profile{sweet,acid,body,fizz,aroma},awards[],buy{url,store},offline{},trend{},blog_anju,generic} · foods{id,name,category,tags[],profile{fat,spice,umami,salt,sweet,weight},alias[],trend{},new} · pairings{d,f,es,reason,blog,src,ev{source,url,quote,who},pf{s,plus[],minus[]}}
- 출처 등급 src: official(양조장 공식) > sommelier(소믈리에·명인) > media(전문 매체) > profile(맛 프로필)
- 온라인 판매 불가 7종: d12 d13 d21 d32 d43 d52 d55

## 작업 방식
- 각 Phase는 플랜 모드로 시작해 계획 확인 후 실행. 한 대화 = 한 Phase.
- Phase 완료 시 docs/05의 검증 체크리스트를 통과했는지 확인하고 결과를 표로 보고.
- 실기기 확인: `pnpm --filter miniapp dev`(vite --host) → 샌드박스 앱에서 `intoss://pairinggo`
- 용어: 종합 점수 overall / 전문가 es / 대중 blog / 맛 프로필 pf.s
