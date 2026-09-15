# 페어링GO

술↔음식 양방향 페어링 추천 → (Stage 2) 전통주 구매 → (Stage 3) 식당 예약.
**플랫폼: 반응형 웹 우선 → 앱스토어·구글플레이. 앱인토스는 후순위** (2026-09-11 변경, 근거·순서는 docs/13). 플랫폼에 관해서는 docs/13이 docs/05보다 우선한다.
기획·설계 문서는 docs/ (00~20). 데이터 운영은 docs/11, 앱 점검 결과·남은 과제는 docs/12·15, **최신 보완점 진단은 docs/20**(2026-09-15, 실측), 이전 진단 docs/18(2026-09-13), 경쟁 서비스(데일리샷·캐치테이블) 분석과 적용안은 docs/19.
현재: **공개 웹 배포됨 — https://pairinggo.vercel.app** (docs/14, Vercel·GitHub 연결, `git push`로 자동 배포) · 검색·구매·주변 판매점·회원(이메일+소셜)·하트·마이페이지 완료(docs/13) · 데이터 수집 도구 완료(docs/11) · 카카오 식당·위치 완료(docs/10).
- 배포 사이트를 확인할 때 클로드 앱의 미리보기 창은 `/_next/static` 자산을 막아 스타일 없이 보인다 — 실제 브라우저(Claude in Chrome 또는 사용자 크롬)로 본다.
다음: 유입 만들기 + 사업자·통신판매업 신고 병행 → PWA → 구매 기능(+푸시) → 스토어 출시.
- "많이 찾는 전통주" 순위 = 인스타·유튜브·네이버 블로그·구글 블로그 최근 30일 언급량 채널별 정규화 평균, 매일 00:00 KST 크론 `/api/cron/mentions` → `drinks.trend`(docs/11 §5-2, 점수 로직 `packages/shared/src/trend.ts`). 인스타는 수동 CSV(`mentions:insta`).
- 급상승·월간 리포트(docs/19 §3-1): 크론이 7일 전 순위를 함께 계산해 `trend.prev_rank/delta`, 배지는 `trend_meta.compared_to`가 있을 때만. `/report`는 `lib/report.ts`가 최근 30일 데이터로 조립(1시간 캐시), "글로 복사"로 SNS 글 생성.
- 휴대폰 레이아웃(767px 이하, docs/19 §5): 하단 탭바 `MobileTabBar`(헤더 메뉴 숨김), 술·음식 상세는 탭바 대신 하단 고정 버튼 `DetailActionBar`(♡ 저장 · 목록 · 구매/맛집). 페어링 카드는 전체 탭에서 10장까지 보이고 더 보기(`PickTabs`), 상세 상단 맛 프로필 막대 `ProfileBars`.
- 공유(docs/20 P0-1·2): 파비콘 `app/icon.tsx`·`apple-icon.tsx`, 링크 미리보기 그림 `app/opengraph-image.tsx`(홈)·`drinks/[slug]`·`foods/[slug]`의 `opengraph-image.tsx`(이름 + 어울리는 것 3개, 한글 폰트는 `lib/og.tsx`가 Google Fonts에서 글자만 받음). 홈처럼 openGraph를 직접 적는 페이지는 `images`를 명시해야 그림이 붙는다. 공유 버튼 `ShareButton`(카카오 SDK → 기기 공유창 → 복사, `share` 이벤트) — 카톡 카드는 `NEXT_PUBLIC_KAKAO_JS_KEY` + 카카오 콘솔 JS SDK 도메인 등록이 있어야 한다.
- PWA(docs/20 P1-3): `app/manifest.ts`·`icon-192.png`·`icon-512.png` 라우트·`public/sw.js`(캐시 없음, 설치 조건용)·`InstallPrompt`(안드로이드 설치창 / 아이폰 안내, 7일 닫힘). 식당 결과는 평점순 위에 관련도(`shared/places.ts placeRelevance`: 이름·분류에 음식 이름/키워드 → 같은 계열 → 다른 계열)로 다시 묶는다.
- 홈 아이콘 메뉴(`QuickMenu`) — 기획 화면 `/michelin`(최근 3년, docs/17) · `/awards`(우리술품평회 수상주) · `/hot`(최근 30일 조합, `lib/hot.ts`). 새 기능은 여기에 한 칸씩.
- 목록 정렬(2026-09-14 사용자 결정): `/drinks`·`/foods` 목록은 가나다순(`byKoName`), 식당 목록은 평점 높은 순(`sortByRating`, 평점 없는 곳은 거리순으로 뒤). `/foods`는 대분류(`shared/food-groups.ts` FOOD_GROUPS: 한식·양식·중식·일식·안주·간식·디저트) 탭 → 소분류 칩(?group=&category=). 새 음식 category는 FOOD_GROUPS에 넣는다(테스트가 잡는다).
- 식당 평점: 구글 지도 평점만(Places API (New) Text Search, `GOOGLE_PLACES_KEY` 서버 전용, 2026-09-14). 카카오 목록 앞 12곳을 이름+좌표로 대조(`shared/place-rating.ts`, 150m·리뷰 5개 이상), `place_ratings`(0018)에 30일 캐시(구글 정책 상한). 평점 필드는 Enterprise 등급(월 1,000회 무료) — 하루 150회 상한(`lib/google-places.ts`). 카카오·네이버 별점은 API 없음·수집 금지. 화면엔 "Google" 표기 필수.
- 식당 수상 배지: 미쉐린만(`restaurant_awards`, 매년 docs/17 절차로 갱신, 로고 금지·자체 ★+연도). **블루리본 목록은 계약 전 절대 가져오지 않는다**(DB 제작자 권리·약관) — 검색 링크만.
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
- 외부 링크는 미니앱은 `apps/miniapp/src/lib/openExternal.ts`, 공개 웹은 `apps/web/app/(site)/_components/ExtLink.tsx`로만 연다(`<a target=_blank>` 직접 사용 금지 — 퍼널 이벤트가 빠진다). 웹 이벤트는 `apps/web/lib/track.ts`. 위치는 `lib/location.ts`(토스 SDK/브라우저)로만, 카카오 로컬 호출은 서버 라우트 `/api/v1/places/*`로만(클라이언트에서 dapi 직접 호출 금지, 쿼터·키 보호).
- **첫 화면은 무조건 로그아웃 상태**(사용자 결정) — 밖에서 들어오면(referrer가 우리 출처가 아니거나 새 탭) `SavedProvider`가 `/api/auth/reset`으로 세션을 지운다. 판정은 `packages/shared/src/session.ts`, 예외는 새로고침·로그인 직후(`AuthAttempt`)뿐. 자동 로그인 유지 기능을 넣지 않는다.
- 로그인은 **Auth.js v5** — 이메일(scrypt 해시, `lib/password.ts`) + 카카오·네이버·구글. Supabase Auth는 네이버 미지원이라 안 쓴다. 세션은 JWT, 우리 `users.id`를 토큰에 담는다.
- 세션·저장 상태는 **`SavedProvider` 한곳에서** 관리하고 경로가 바뀌면 다시 확인한다. 앱 라우터는 레이아웃을 리마운트하지 않아 로그인 직후 헤더가 안 바뀐다. 서버 컴포넌트에서 `auth()`를 부르면 공개 페이지 정적 생성이 깨지므로 공개 페이지에서는 쓰지 않는다.
- 저장(찜)은 전통주·음식·**음식점**. 음식점은 카탈로그에 없으므로 `saved_items.meta`(jsonb)에 이름·주소·링크를 함께 담는다. 카카오 로컬은 **사용자가 누를 때만** 부른다(유료 쿼터).
- 페어링 묶음: official·sommelier=**전문가픽**, media·blog=**대중픽**, profile·ai=맛 분석(`pairing/pick.ts`). 회원 '먹어봤어요'(어울렸다·보통·별로, `pairing_ratings`, `/api/ratings`)는 근거 점수·등급과 섞지 않는다. 첫 화면 로그아웃 판정은 **문서당 한 번**(앱 라우터 이동마다 다시 판정하면 링크로 들어와 로그인한 회원이 로그아웃된다).
- 회원 추천 페어링(회원픽, docs/13): 글은 바로 게시, 하트(`member_pick_likes`) 많은 순. 한 글 하트 `MEMBER_PICK_LIKES_MIN`(3) 또는 같은 조합 글 `MEMBER_PICK_MIN`(2)이면 `pairings` src 'user' 자동 생성(`lib/member-picks.ts`). users 조인은 FK 이름 지정(`users!member_picks_user_id_fkey`). 닉네임만 노출, 글 140자·링크 금지, 사진 1장(Storage `member-picks`), 카탈로그에 없는 이름은 `/admin/picks` 검수 후. 카탈로그 캐시는 15초마다 version을 확인한다(다른 프로세스의 발행 반영).
- 마이페이지 "먹어봤나요?"(`TriedCard`, 저장한 술·음식의 미평가 조합 3개, `shared/pairing/tried-suggest.ts`) · 추천인(`users.referred_by`, 0019, 가입·가입 마무리 때 닉네임으로, 보상은 "초대한 친구 N명"뿐) — docs/19 §3-1.
- 회원 프로필: 가입 때 닉네임(2~12자, 중복·링크·운영자 사칭 금지 `nicknameProblem`)·성별·생년월일(8자리 직접 입력 `birthDigitsToDate`, 만 19세 이상)·시도 필수(`packages/shared/src/profile.ts`), 소셜 회원은 `/profile`. 닉네임이 없거나 규칙 위반이면 `SavedProvider`가 `/profile`로 보낸다(`setupNeeded`). **간편로그인은 기존 회원의 닉네임을 덮어쓰지 않는다**(auth.ts upsertUser). 닉네임을 바꾸면 회원픽 근거(`pairing_evidence.who`)도 함께 바꾼다. 로그인 회원의 events·search_logs에 `user_id`가 붙는다.
- 개인정보처리방침 `/privacy`·이용약관 `/terms`(본문 `_components/legal/`, 운영자·시행일 `lib/legal.ts`) + 가입 동의(이용약관·개인정보 수집·이용·만 19세, `packages/shared/src/consent.ts`, `users.consent_version`). 간편가입은 계정 연결 뒤 `/profile`(가입 마무리)에서 동의 — `SavedProvider`가 동의 전 회원을 보낸다. **수집 항목·목적·위탁이 바뀌면 방침 본문 + `CONSENT_VERSION`을 올린다**(기존 회원 재동의). 탈퇴 `/withdraw`(`deleteAccount`: cascade + 근거 글·사진 삭제, 로그는 user_id null). 주문을 받으면 양조장에 주문자 정보를 넘기므로 제3자 제공 동의는 그때 별도.
- 비밀키는 apps/web/.env.local(SUPABASE_SERVICE_ROLE_KEY·CRON_SECRET·AUTH_*)과 packages/db/.env(DATABASE_URL)에만. 미니앱 번들엔 VITE_API_BASE_URL·VITE_KAKAO_JS_KEY(도메인 제한 공개 키)만. KAKAO_REST_KEY는 apps/web 서버 전용. 채팅·커밋에 키 금지.
- 카탈로그 파생값(D·F·byDrink·DOCS 등)은 `export let` 라이브 바인딩 — 모듈 로드 시 복사하지 말고 사용 시점에 읽는다(applyDataset 핫스왑 대응).
- 온라인 판매 불가 주류(`NON_TRAD`, online_sellable=false)는 구매 링크 대신 "온라인 직배송 불가" 안내.
- 주류 경고문구·만 19세 안내는 전 페이지 공통 푸터. AI 생성 페어링은 `source: ai` 배지(Phase 9).
- 모든 UI 텍스트 한국어. **미니앱은 모바일 고정 390px(최대 430px 중앙) — 데스크톱까지 넓히지 않는다**(그대로 앱이 된다). **공개 웹(`apps/web/(site)`)은 반응형**. 라이트·다크 모두 토큰으로.
- 외부 링크는 실제로 열렸을 때만 퍼널 이벤트를 남긴다(실패는 `link_open_failed`). `buy_link_click`은 입점 제안 자료이자 `refresh_pairing_feedback` 입력이라 부풀리면 안 된다.
- 페어링 순위 = 등급 → 근거 링크 있음(+3) → 점수(`pairing/score.ts`). 맛 프로필 점수(pf.s)는 카탈로그 전체 `profileFit` 백분위 한 눈금 — 술·페어링을 넣거나 맛 규칙을 바꾸면 `pnpm --filter @pairinggo/db pf-recalc` → `db:export`(docs/18 §1-1).
- 검색·점수·유사도 로직은 packages/shared에만 두고 테스트를 먼저 쓴다. 컴포넌트에 계산 로직을 넣지 않는다.
- 커밋은 기능 단위로 작게. 커밋 메시지는 한국어 요약 + 영어 scope 허용.

## 데이터
- 원본: packages/shared/data/pairings.json (전통주 225 · 음식 143 · 페어링 2,184 — 2026-09-13 라인업 확장 +99종 §5-4, 백경증류소 +7종·한증류소 +3종 §5-5, 2026-09-14 음식 확장 +33종 양식·중식·일식·아시아 §5-6, 2026-09-15 다농바이오 +3·신선주 +5 §5-7, docs/11). 새 음식은 `add-foods`(맛 분석 `planDrinksForFood`). DB가 원본이고 JSON은 `db:export`로 내보낸 번들.
- 라인업 확장(`shop-insight`·`lineup`): 네이버 쇼핑 검색 API는 2026-07-31 종료, 스마트스토어 자동 수집은 약관 위반 → 쇼핑인사이트만. 새 술 설명은 사실로 새로 짓고(aT 원문 금지) 맛 프로필·맛 분석 페어링은 추정값. drinks.alias[0]은 짧은 이름(양조장 이름 넣지 않기). 필드: drinks{id,name,alias,category,abv,region,brewery,desc,flavor[],profile{sweet,acid,body,fizz,aroma},awards[],buy{url,store},offline{},trend{},blog_anju,generic} · foods{id,name,category,tags[],profile{fat,spice,umami,salt,sweet,weight},alias[],trend{},new} · pairings{d,f,es,reason,blog,src,ev{source,url,quote,who},pf{s,plus[],minus[]}}
- 출처 등급 src: official(양조장 공식) > sommelier(소믈리에·명인) > media(전문 매체) > profile(맛 프로필)
- 온라인 판매 불가 7종: d12 d13 d21 d32 d43 d52 d55

## 작업 방식
- 각 Phase는 플랜 모드로 시작해 계획 확인 후 실행. 한 대화 = 한 Phase.
- Phase 완료 시 docs/05의 검증 체크리스트를 통과했는지 확인하고 결과를 표로 보고.
- 실기기 확인: `pnpm --filter miniapp dev`(vite --host) → 샌드박스 앱에서 `intoss://pairinggo`
- 용어: 종합 점수 overall / 전문가 es / 대중 blog / 맛 프로필 pf.s
