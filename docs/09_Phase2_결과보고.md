# 09. Phase 2 결과 보고 — Supabase 스키마 · 시드 · 공개 API · 카탈로그 핫스왑

작성 2026-09-10 · 저장소 `D:\6. 페어링 앱 제작\pairinggo`

## 1. 만든 것

| 영역 | 내용 |
|---|---|
| `packages/db` | 마이그레이션 3개(`0001_catalog` 카탈로그 5테이블 · `0002_logs` 이벤트·검색로그·인기검색어 · `0003_accumulation` **출처·후보큐·근거보강·피드백·스냅샷**) + `migrate`/`seed`/`export` 스크립트. Supabase CLI·Docker 없이 `postgres` 드라이버로 실행. 시드는 멱등(upsert), 108/110/851 자동 검증 |
| `apps/web` (Next.js 16) | 공개 API 7개 + 크론 1개. **Supabase 키가 없으면 내장 데이터로 응답하는 정적 폴백** → 키 없이도 전 구간 동작 |
| `packages/shared` | `applyDataset()`으로 카탈로그 핫스왑(모든 파생 인덱스·검색 문서 재계산), zod 스키마(Dataset·CatalogResponse·EventBatch), DB 행↔Dataset 변환(`rows.ts`) |
| `apps/miniapp` | 시작 시 서버 카탈로그 버전 비교 → 다르면 내려받아 교체·로컬 캐시(`pgo_catalog`) · 퍼널 이벤트 30초/화면 숨김/50건마다 서버 전송 · 인기 검색어 서버 집계 우선 · 마이 화면에 카탈로그 출처·버전 표시 |

### API (`/api/v1`)

| 엔드포인트 | 동작 | 캐시 |
|---|---|---|
| `GET /catalog` | Dataset + version, `ETag`=version, `If-None-Match` → 304 | s-maxage 300 |
| `GET /catalog/version` | `{version, counts, source}` | s-maxage 300 |
| `GET /drinks/:id` · `/foods/:id` | 상세 + 페어링(상대 이름 포함) | s-maxage 300 |
| `GET /search?q=` | 서버에서 같은 검색 엔진(이름·상황) 실행 + `search_logs` 적재 | no-store |
| `GET /popular` | `popular_terms` 상위 10/10, 없으면 트렌드 폴백 | s-maxage 300 |
| `POST /events` | zod 검증 배치(≤100, 32KB) → `events`·`search_logs`. DB 없으면 202 | — |
| `GET /api/cron/popular` | Bearer `CRON_SECRET` → `refresh_popular_terms()` + `refresh_pairing_feedback()` (Vercel cron 매일 03:00 KST) | — |

응답 헤더 `x-pairinggo-source: static|db` 로 데이터 출처 확인.

## 2. 페어링 데이터 축적 구조 (사용자 질문에 대한 설계 반영)

```
후보 수집 ──▶ pairing_candidates (원문·출처·매칭 ID·상태 draft/needs_entity/rejected/promoted)
   │ origin: manual · sheet · search_log · ai · user · profile_rule
   ▼
정규화·검수 ──▶ pairings (curated) + pairing_evidence (여러 근거, source_id·captured_at·snapshot_path)
   │            sources (출처 마스터: 매체·양조장·인물, 기본 등급·신뢰도)
   ▼
배포 ──▶ catalog_meta.version + catalog_snapshots (버전별 JSON 보관) ──▶ 앱 핫스왑
   ▲
암묵 신호 ──▶ events → refresh_pairing_feedback() → pairing_feedback (카드탭·저장·구매클릭 집계)
검색 로그 ──▶ search_logs → refresh_popular_terms() → popular_terms (없는 검색어 = 확장 우선순위)
```
저장 원칙: **쓰기는 Postgres(원장), 읽기는 버전 붙은 스냅샷 JSON(API·CDN·앱 캐시)**, git의 `pairings.json`은 백업·시드(`db export`로 역동기화).

## 3. 검증 결과

| 항목 | 결과 |
|---|---|
| `pnpm test` (shared) | **72/72** — 기존 65 + applyDataset 4 + zod 3 |
| typecheck (shared·db·web·miniapp) | 오류 0 |
| `pnpm --filter web build` | 성공 (라우트 10개) |
| `pnpm --filter miniapp build` | 경고 0 · JS 980KB(gzip 232KB, zod 추가) · `pairinggo.ait` 생성 |
| 키 없이 API | `/catalog` 200 + `x-pairinggo-source: static` · 484KB · ETag 304 동작 · `/search` 상황 검색 응답 · `/popular` 트렌드 폴백 · `/events` 202 · 개인정보 필드 400 · `/drinks/nope` 404 |
| 미니앱 ↔ API | 마이 화면 "카탈로그 서버 · static-4f3 · 방금 갱신" (핫스왑 경로 동작), 이벤트 POST 202, 서버 꺼도 내장 데이터로 정상 |
| 발견·수정 | 화면 로그의 `name` 필드가 개인정보 금지 목록에 걸려 400 반복 → 필드명 `path`로, 4xx 거부 배치는 큐에서 제거(재시도 폭주 방지) |

### DB 모드 검증 (2026-09-10, Supabase 연결 후)

| 항목 | 결과 |
|---|---|
| `pnpm db:migrate` | 0001~0004 적용 (0004: Supabase safeupdate — WHERE 없는 DELETE 금지 — 대응) |
| `pnpm db:seed` | drinks 108 · foods 110 · pairings 851 · evidence 281 · 스냅샷 1 · version `2026-09-10T02:29:05Z` |
| `/api/v1/catalog/version` | `source: db`, ETag = DB 버전 |
| `POST /events` | `stored: true`, `search_logs` 자동 적재 |
| `/api/cron/popular` | `popularTerms`·`pairingFeedback` 집계 성공 → `/popular` `source: logs` |
| RLS | 12개 테이블 전부 켜짐 (`pnpm db:status`) |
| 겪은 문제 | `SUPABASE_URL`을 대시보드 주소로 잘못 넣음 → service_role JWT의 `ref`로 복원. `DATABASE_URL`은 Session pooler 사용 |

## 4. 사용자가 할 일 — Supabase 연결 (10분)

1. https://supabase.com → **New project** (Free, Region: Northeast Asia (Seoul), DB Password 저장)
2. **Project Settings → API**: `Project URL`, `service_role` key 복사 → `apps/web/.env.local`
   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   CRON_SECRET=아무긴문자열
   ```
3. **Connect → Direct connection** (또는 Session pooler) 문자열 → `packages/db/.env`
   ```
   DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@...supabase.com:5432/postgres
   ```
4. 터미널:
   ```bash
   pnpm db:migrate
   ```
   ```bash
   pnpm db:seed
   ```
   → `시드 완료 — drinks 108 · foods 110 · pairings 851 …` 확인
5. `pnpm dev:web` 후 `http://localhost:3000/api/v1/catalog/version` 에서 `"source":"db"` 확인 → 미니앱 마이 화면에 "서버 · 2026-…" 표시
6. (배포 시) Vercel에 `apps/web` 연결, 같은 env 3개 등록. 미니앱 `.env.local`의 `VITE_API_BASE_URL`을 배포 주소로 바꾸고 번들 재빌드

## 5. 계획 대비 변경
- 정적 모드 버전을 `"bundled"` 대신 내용 해시 `static-xxxxxxxx`로 → 키 없이도 핫스왑 경로를 검증
- `rows.ts`(DB행→Dataset)는 `packages/db`가 아닌 `packages/shared`에 둠 (web이 postgres 드라이버에 의존하지 않도록)
- 이벤트 `screen` 프로퍼티명 `name` → `path`

## 6. 다음: Phase 3 (토스 로그인 · 카카오 식당 · 위치 SDK · 검수 제출)
docs/05 Phase 3. 선행: 앱인토스 콘솔 앱 등록(사업자 있으면 로그인·푸시 가능), 카카오 디벨로퍼스 키.
