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

## 6. 그 다음

배포가 되면 Claude가 위 3번 항목을 실제 주소로 확인하고, 미니앱의 `VITE_API_BASE_URL`을 배포 주소로 바꿔 앱도 같은 서버를 보게 한다.
