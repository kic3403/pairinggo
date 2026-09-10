# 페어링GO

술을 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 — 근거와 함께. 토스 앱인토스 미니앱.

## 시작

```bash
pnpm install
pnpm test                # packages/shared 유닛 테스트
pnpm dev                 # apps/miniapp (vite --host :5173) → 브라우저(AIT Devtools)에서 확인
pnpm dev:web             # apps/web 공개 API (:3000) — Supabase 키 없으면 내장 데이터로 응답
pnpm build               # 전체 빌드 (miniapp → apps/miniapp/pairinggo.ait, web → .next)
```

미니앱이 서버를 쓰게 하려면 `apps/miniapp/.env.local`에 `VITE_API_BASE_URL=http://localhost:3000`, 지도는 `VITE_KAKAO_JS_KEY`. 서버 식당 검색은 `apps/web/.env.local`의 `KAKAO_REST_KEY` (카카오 디벨로퍼스 → 앱 → 플랫폼 키, 카카오맵 사용 설정 ON).

## Supabase 연결 (선택 — 없어도 동작)

1. supabase.com에서 프로젝트 생성 (Seoul, Free)
2. `apps/web/.env.local`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` (`.env.example` 참고)
3. `packages/db/.env`: `DATABASE_URL` (Connect → Direct connection)
4. `pnpm db:migrate` → `pnpm db:seed` (108/110/851 검증 출력)

자세한 절차: [docs/09](docs/09_Phase2_결과보고.md) 4장.

## 구조

| 경로 | 내용 |
|---|---|
| `apps/miniapp` | Vite + React 미니앱 (정적 번들, 앱인토스 SDK 3.x) |
| `apps/web` | Next.js 공개 API · 크론 · 랜딩 (Vercel) |
| `packages/shared` | 데이터·검색 엔진·상황 검색·페어링 점수·유사도·zod 스키마 (Vitest) |
| `packages/db` | Supabase 마이그레이션·시드·export |
| `docs/` | 기획·설계·로드맵·결과보고 (00~09) |
| `scripts/check-links.mjs` | 주간 구매 링크 점검 |

계획과 규칙: [CLAUDE.md](CLAUDE.md), [docs/05 로드맵](docs/05_개발로드맵_Phase별.md)
