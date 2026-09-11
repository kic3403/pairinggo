# 페어링GO

술↔음식 양방향 페어링 추천 → (Stage 2) 전통주 구매 → (Stage 3) 식당 예약.
**플랫폼: 반응형 웹 우선 → 앱스토어·구글플레이. 앱인토스는 후순위** (2026-09-11 변경, 근거·순서는 docs/13). 플랫폼에 관해서는 docs/13이 docs/05보다 우선한다.
기획·설계 문서는 docs/ (00~13). 데이터 운영은 docs/11, 앱 점검 결과·남은 과제는 docs/12.
현재: 공개 웹 1차 완료(docs/13) · 데이터 수집 도구 완료(docs/11) · 카카오 식당·위치 완료(docs/10).
다음: 유입 만들기 + 사업자·통신판매업 신고 병행 → PWA → 구매 기능(+푸시) → 스토어 출시.
- 전통주 지역별 목록(2026-09-11, docs/11 §5-1): `packages/db/research/`(더술닷컴 1,300종·찾아가는 양조장 64·네이버 백과) → `pnpm --filter @pairinggo/db regional` → `templates/전통주_지역별_목록.xlsx`. 시도 순서·정규화는 `packages/db/src/sido.ts` (광주는 전남에 묶음, 2026-07 통합). aT 문구는 공공누리 4유형 — 앱 화면에 원문 그대로 싣지 않는다.

## 구조 (pnpm workspaces)
- apps/miniapp      Vite + React 19 + TS + Tailwind v4 + react-router 7. @apps-in-toss/web-framework 3.x (apps-in-toss.config.ts, 테스트는 AIT Devtools 브라우저). **정적 번들만(SSR·서버 코드 금지)**. `pnpm --filter miniapp dev|build`
- packages/shared   @pairinggo/shared — 데이터(data/pairings.json)·타입·검색 엔진(search/)·페어링 점수(pairing/)·유사도·지역·별점. Vitest
- scripts/          check-links.mjs (주간 구매 링크 점검 → packages/shared/data/link-status.json)
- apps/web          Next.js 16 (Vercel) — **공개 반응형 웹 `(site)`**(`/`·`/drinks`·`/drinks/[slug]`·`/foods`·`/foods/[slug]`·sitemap·robots, 서버 렌더 = 검색 유입용) + 공개 API `/api/v1/*` + 크론 + **운영 어드민 `/admin`**(ADMIN_PASSWORD, 검수·승격·발행). SUPABASE_* 없으면 shared 내장 데이터로 정적 폴백(`x-pairinggo-source`). `pnpm dev:web`
  - 라우트 경로 세그먼트는 **영문만** — 한글 폴더명은 Next.js 정적 생성에서 깨진다. 슬러그(동적 구간)는 한글 유지(`/drinks/복순도가-손막걸리`), 대조는 shared `slugKey()`.
  - `body` 색은 구역 CSS(`site.css`·`admin.css`)가 정한다. 루트 레이아웃에 색을 고정하면 다크 모드가 깨진다.
- packages/db       마이그레이션(SQL 0001~0006)·시드·export·**엑셀 가져오기(db:import)·자동 수집(db:collect)·status** — `postgres` 드라이버. DATABASE_URL은 packages/db/.env

## 절대 규칙
- 앱인토스 제약: 미니앱에 서버 코드·SSR 금지. 로그인은 토스 로그인만(Phase 3). 실물 결제는 토스페이만(Phase 5). 외부 결제창·외부 의존 링크 금지 — 예외는 법적 고지·제휴기관 공식 페이지·"제품 추천 후 구매 플랫폼 이동"(구매 버튼 문구: "양조장 공식몰로 이동").
- 외부 링크는 `apps/miniapp/src/lib/openExternal.ts`로만 연다(`<a target=_blank>` 직접 사용 금지). 위치는 `lib/location.ts`(토스 SDK/브라우저)로만, 카카오 로컬 호출은 서버 라우트 `/api/v1/places/*`로만(클라이언트에서 dapi 직접 호출 금지, 쿼터·키 보호).
- 간편로그인은 **Auth.js v5**(카카오·네이버·구글). Supabase Auth는 네이버 미지원이라 안 쓴다. 세션은 JWT, 우리 `users.id`를 토큰에 담는다. 헤더 로그인 상태는 **클라이언트에서** 세션을 가져온다 — 서버에서 `auth()`를 부르면 공개 페이지 정적 생성이 깨진다. 로그인 공개 전 개인정보처리방침·동의 필요.
- 비밀키는 apps/web/.env.local(SUPABASE_SERVICE_ROLE_KEY·CRON_SECRET·AUTH_*)과 packages/db/.env(DATABASE_URL)에만. 미니앱 번들엔 VITE_API_BASE_URL·VITE_KAKAO_JS_KEY(도메인 제한 공개 키)만. KAKAO_REST_KEY는 apps/web 서버 전용. 채팅·커밋에 키 금지.
- 카탈로그 파생값(D·F·byDrink·DOCS 등)은 `export let` 라이브 바인딩 — 모듈 로드 시 복사하지 말고 사용 시점에 읽는다(applyDataset 핫스왑 대응).
- 온라인 판매 불가 주류(`NON_TRAD`, online_sellable=false)는 구매 링크 대신 "온라인 직배송 불가" 안내.
- 주류 경고문구·만 19세 안내는 전 페이지 공통 푸터. AI 생성 페어링은 `source: ai` 배지(Phase 9).
- 모든 UI 텍스트 한국어. **미니앱은 모바일 고정 390px(최대 430px 중앙) — 데스크톱까지 넓히지 않는다**(그대로 앱이 된다). **공개 웹(`apps/web/(site)`)은 반응형**. 라이트·다크 모두 토큰으로.
- 외부 링크는 실제로 열렸을 때만 퍼널 이벤트를 남긴다(실패는 `link_open_failed`). `buy_link_click`은 입점 제안 자료이자 `refresh_pairing_feedback` 입력이라 부풀리면 안 된다.
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
