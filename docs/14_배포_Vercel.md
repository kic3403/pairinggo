# 14. 공개 웹 배포 — Vercel (2026-09-12)

지인에게 링크를 돌리려면 인터넷 주소가 필요하다. `apps/web`(Next.js)을 Vercel에 올린다. 미니앱(`apps/miniapp`)은 이번 배포 대상이 아니다.

**누가 무엇을 하나** — 계정 로그인이 필요한 두 단계(GitHub 푸시, Vercel 연결)는 사용자가 한다. 나머지 설정·환경변수 정리·검증은 Claude가 준비했다.

## 0. 준비된 것

- `apps/web/vercel.json` — 모노레포 루트에서 설치·빌드하도록 명령을 명시. 크론(인기 검색어 집계) 포함.
- `ADMIN_PASSWORD` 임시값 제거 → 무작위 24자. `ADMIN_SECRET`(세션 서명 키)을 비밀번호와 분리해 생성. 값은 `apps/web/.env.local`에만 있다.
- `siteUrl()`은 `SITE_URL`이 없으면 Vercel이 주는 `VERCEL_PROJECT_PRODUCTION_URL`을 쓴다 → 첫 배포에 SITE_URL을 넣지 않아도 사이트맵·canonical이 맞는다.
- Auth.js는 `trustHost: true` → `*.vercel.app` 주소에서 그대로 동작한다.
- `.env*`는 gitignore. 추적 중인 env 파일 없음(확인).

## 1. GitHub에 올리기 (사용자, 5분)

1. https://github.com/new → 저장소 이름 `pairinggo`, **Private**, README 없이 생성.
2. 생성 화면에 나오는 주소를 아래 `<주소>`에 넣고 터미널에서 실행 (프로젝트 폴더에서):

```bash
git remote add origin <주소>
```

```bash
git push -u origin main
```

처음 푸시하면 브라우저 창이 떠서 GitHub 로그인을 요구한다. 그 뒤로는 Claude가 커밋할 때마다 푸시만 하면 자동 배포된다.

## 2. Vercel 연결 (사용자, 10분)

1. https://vercel.com → GitHub 계정으로 가입/로그인 → **Add New… → Project** → `pairinggo` 저장소 **Import**.
2. 설정 화면에서 딱 하나 바꾼다: **Root Directory** → `Edit` → `apps/web` 선택. Framework는 Next.js로 자동 인식된다. Build/Install 명령은 `vercel.json`이 정하므로 건드리지 않는다.
3. **Environment Variables**에 아래 표를 입력한다. 값은 `apps/web/.env.local`을 열어 복사한다(채팅에 붙이지 말 것). 환경은 Production·Preview 둘 다 체크.
4. **Deploy**. 2~3분 뒤 `https://pairinggo-….vercel.app` 주소가 나온다.

### 환경변수

| 이름 | 필수 | 어디서 | 용도 |
|---|---|---|---|
| `SUPABASE_URL` | 필수 | `.env.local` | DB |
| `SUPABASE_SERVICE_ROLE_KEY` | 필수 | `.env.local` | DB (서버 전용) |
| `KAKAO_REST_KEY` | 필수 | `.env.local` | 맛집·판매점 검색 |
| `ADMIN_PASSWORD` | 필수 | `.env.local` (새로 생성된 값) | `/admin` 로그인 |
| `ADMIN_SECRET` | 필수 | `.env.local` (새로 생성된 값) | 어드민 세션 서명 |
| `AUTH_SECRET` | 필수 | `.env.local` | 회원 세션 서명 |
| `CRON_SECRET` | 필수 | `.env.local` | 크론 인증 (Vercel이 자동으로 헤더에 실어 보냄) |
| `ALLOWED_ORIGINS` | 선택 | 비움 | 비우면 공개 API가 모든 출처 허용 |
| `AUTH_KAKAO_ID` / `AUTH_KAKAO_SECRET` | 선택 | 카카오 개발자 콘솔 | 간편로그인 |
| `AUTH_NAVER_ID` / `AUTH_NAVER_SECRET` | 선택 | 네이버 개발자센터 | 간편로그인 |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | 선택 | 구글 클라우드 콘솔 | 간편로그인 |
| `SITE_URL` | 선택 | 나중에 도메인 연결 시 | 사이트맵·canonical 절대 주소 |

`DATABASE_URL`은 넣지 않는다 — `packages/db` 스크립트(로컬)만 쓴다.

## 3. 배포 직후 확인 (Claude가 주소를 받으면 대신 확인)

- `/` · `/drinks` · `/drinks/복순도가-손막걸리` · `/search?q=육회` · `/sitemap.xml` · `/robots.txt` 200
- `/api/v1/catalog/version` 응답 헤더 `x-pairinggo-source: db` (static이면 SUPABASE 변수 누락)
- 회원가입 → 하트 → `/my` 유지
- `/admin` 로그인(새 비밀번호)
- 음식 상세에서 지역 버튼 → 맛집 결과 (없으면 `KAKAO_REST_KEY` 확인)

## 4. 소셜 로그인을 켤 때 (배포 주소가 생긴 뒤)

각 콘솔의 리디렉션(콜백) URL에 배포 주소를 등록한다.

| 공급자 | 콜백 URL |
|---|---|
| 카카오 | `https://<배포주소>/api/auth/callback/kakao` |
| 네이버 | `https://<배포주소>/api/auth/callback/naver` |
| 구글 | `https://<배포주소>/api/auth/callback/google` |

로컬 테스트용으로 `http://localhost:3000/api/auth/callback/<공급자>`도 함께 등록해 두면 편하다.

## 5. 공개 전에 알아 둘 것

- **개인정보처리방침·수집 동의**가 아직 없다. 지인 테스트 단계라면 "테스트 중이며 이메일·닉네임을 저장한다"고 말로 알리고, 정식 공개 전에 문서를 붙인다(docs/12 A·docs/13).
- 어드민 로그인에 시도 횟수 제한이 없다(docs/12 C5). 비밀번호를 무작위 24자로 바꿔 두어 당장의 위험은 낮지만, 공개 트래픽이 생기면 제한을 붙인다.
- 카카오 로컬은 일일 쿼터가 있다. 판매점·맛집 검색은 버튼을 눌렀을 때만 부르도록 되어 있다.
- 배포 주소가 바뀌거나 커스텀 도메인을 붙이면 `SITE_URL`과 OAuth 콜백 URL을 함께 바꾼다.

## 6. 배포 결과 (2026-09-12)

**https://pairinggo.vercel.app** — GitHub 연결, Root Directory `apps/web`, 환경변수 7개.

3번 확인 항목 [실측]

| 항목 | 결과 |
|---|---|
| `/` `/drinks` `/foods` `/search` `/drinks/…` `/foods/…` `/login` `/signup` `/sitemap.xml` `/robots.txt` | 전부 200 (0.4~1.0s) |
| `/my` `/admin` 비로그인 | 307 → 로그인 |
| `/api/v1/catalog/version` | `x-pairinggo-source: db` · 술 108·음식 110·페어링 852 |
| 사이트맵·canonical | `https://pairinggo.vercel.app/…` 절대주소 (SITE_URL 없이 Vercel 변수로 해결) |
| 술 상세 서버 렌더 | 카드 28·구매 버튼 2·파는 곳 섹션 |
| 맛집 검색 API | 홍대 육회 → 실제 결과 (KAKAO_REST_KEY 정상) |
| 어드민 로그인 | 새 비밀번호로 성공, `/admin` 200 |
| 회원가입 | 테스트 계정 생성 확인 후 삭제 |
| 실제 크롬 렌더 | 스타일·검색창·구매·현장 판매 박스 정상 |

**미리보기 창 주의** — 클로드 앱 안의 미리보기 창은 `/_next/static/*` 자산을 `ERR_BLOCKED_BY_CLIENT`로 막아 배포 사이트가 **스타일 없이** 보인다. 서버는 자산을 200으로 정상 서빙한다(curl 확인). 배포 사이트 확인은 일반 브라우저로.

미니앱 `VITE_API_BASE_URL`을 배포 주소로 바꿨다(로컬 .env.local). 이후 커밋은 `git push`만 하면 자동 배포된다.

## 7. 검색엔진 등록 (2026-09-28 — 유입의 첫 단추)

2026-09-28까지 구글·네이버 어디에도 사이트를 등록한 기록이 없었다. 사이트맵(718개 주소)은 있었지만 알린 적이 없다.
코드 쪽 준비(완료): 소유 확인 태그를 환경변수로 넣는 자리(`app/layout.tsx`), RSS `/rss.xml`(오늘의 페어링 14일, 홈·오늘의 페어링에 링크), IndexNow 키 `/indexnow-key.txt` + 제출 스크립트, 사이트맵 수정 시각을 카탈로그 발행 시각으로(매번 "지금"이면 검색엔진이 믿지 않는다).

| 순서 | 할 일 | 누가 |
|---|---|---|
| 1 | 네이버 서치어드바이저(searchadvisor.naver.com) → 웹마스터 도구 → 사이트 등록 `https://pairinggo.vercel.app` → 소유 확인 방법 **HTML 태그** → `content="…"` 값만 복사 | 사용자 |
| 2 | 구글 서치 콘솔(search.google.com/search-console) → 속성 추가 → **URL 접두어** `https://pairinggo.vercel.app` → **HTML 태그** → `content` 값 복사 | 사용자 |
| 3 | Vercel → 프로젝트 → Settings → Environment Variables에 `NAVER_SITE_VERIFICATION`·`GOOGLE_SITE_VERIFICATION`(Production) → 다시 배포 | 사용자 |
| 4 | 두 곳에서 "소유 확인" 누르기 | 사용자 |
| 5 | 네이버: 요청 → 사이트맵 제출 `https://pairinggo.vercel.app/sitemap.xml`, RSS 제출 `https://pairinggo.vercel.app/rss.xml` · 구글: Sitemaps에 `sitemap.xml` | 사용자 |
| 6 | IndexNow 제출 `pnpm --filter @pairinggo/db indexnow`(네이버·빙에 주소 718개를 한 번에) — 카탈로그를 크게 바꾼 뒤마다 | Claude 또는 사용자 |

빙은 선택(`BING_SITE_VERIFICATION`, 빙 웹마스터 도구는 구글 서치 콘솔에서 가져오기도 된다). vercel.app 주소로 등록해 두고 나중에 도메인을 사면 `SITE_URL`을 바꾸고 새 도메인을 다시 등록한다(옛 주소는 Vercel이 새 도메인으로 넘기게 설정).


## 8. 대표 도메인 pairinggo.kr (2026-09-30)

가비아에서 `pairinggo.kr`·`pairinggo.com` 구매(자동 연장). 대표는 **pairinggo.kr**(사용자 결정).
- Vercel(공개 사이트 프로젝트) Domains: `pairinggo.kr` → Production · `www.pairinggo.kr` → 308 → pairinggo.kr · `pairinggo.com`·`www.pairinggo.com` → 308 → pairinggo.kr · `pairinggo.vercel.app` → 로그인 콘솔을 옮긴 뒤 308 → pairinggo.kr.
- 가비아 DNS(pairinggo.kr): A `@` = Vercel이 보여 준 IP, CNAME `www` = Vercel이 보여 준 프로젝트 전용 주소(끝에 점). pairinggo.com도 같은 두 줄.
- 환경변수: 공개 사이트 `SITE_URL`·`NEXT_PUBLIC_SITE_URL` = `https://pairinggo.kr`, 파트너 앱 `NEXT_PUBLIC_SITE_URL` = `https://pairinggo.kr`. 코드 기본값도 pairinggo.kr로 바꿨다.
- 로그인(Auth.js, trustHost)은 요청 주소 기준 → 카카오·네이버·구글 콘솔에 `https://pairinggo.kr/api/auth/callback/{kakao|naver|google}` 추가, 카카오 JS SDK 도메인·플랫폼 사이트 도메인에 `https://pairinggo.kr`. 옛 주소는 옮긴 뒤 며칠 두었다 지운다.
- 주소가 바뀌면 브라우저별 저장(최근 본·관심지역·웹 푸시 구독·로그인 쿠키)은 새 주소에서 다시 시작한다(출처가 다르다).
