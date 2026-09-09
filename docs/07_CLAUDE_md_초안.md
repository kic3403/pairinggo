# CLAUDE.md 초안 — 새 모노레포 루트에 `CLAUDE.md`로 저장

```markdown
# 페어링GO

술↔음식 양방향 페어링 추천 + 전통주 앱 내 구매 + 식당 자체 예약. 토스 앱인토스 미니앱이 주력.
기획·설계 문서는 docs/ (00~07). 작업 전 해당 Phase 문서를 읽는다: docs/05_개발로드맵_Phase별.md

## 구조 (pnpm workspaces + Turborepo)
- apps/miniapp   Vite + React 18 + TS. @apps-in-toss/web-framework. 정적 번들만(SSR 금지). `npx ait deploy`
- apps/web       Next.js 16 App Router. /api/v1(공개 API) · /partner(파트너 어드민) · /admin(운영) · /(랜딩·약관)
- packages/shared 타입·zod 스키마·페어링/검색/초성/별점 로직·API 클라이언트
- packages/ui    Tailwind v4 preset·공용 컴포넌트 (브랜드: 술 #22406B · 음식 #E4572E)
- packages/db    Supabase 마이그레이션(SQL)·시드·생성 타입

## 절대 규칙
- 앱인토스 제약: 미니앱에 서버 코드·SSR 금지. 로그인은 토스 로그인만. 실물 결제는 토스페이만. 외부 결제창·외부 의존 링크 금지(법적 고지·제휴기관 공식 페이지·Stage 1 구매 플랫폼 이동만 예외).
- 비밀키는 apps/web 서버 전용(.env.local). 미니앱 번들엔 KAKAO_JS_KEY·API_BASE_URL만.
- 결제·주문·예약 상태 변경은 서버에서만, 멱등키 필수. 금액은 서버가 재계산.
- 성인인증(adult_verified_at, 12개월) 없이는 상품 구매·예약 API가 403.
- 온라인 판매 불가 주류(drinks.online_sellable=false)는 상품 등록·노출 불가.
- 주류 할인 10%·사은품 10% 상한, 경고문구 상시 노출, AI 생성 페어링은 `source: ai` 배지.
- 모든 UI 텍스트 한국어. 모바일 퍼스트 390px. 라이트·다크.
- AI 응답은 zod 스키마 검증 후 사용. 검색 흐름: DB → 캐시 → Claude API.
- 커밋은 기능 단위로 작게. 예약 슬롯·주문 상태 머신·정산 계산은 Vitest 테스트 필수.

## 데이터
- 원본 시드: packages/db/seed/pairings.json (전통주 108 · 음식 110 · 페어링 851, 근거 ev·출처 등급 src·맛 프로필 pf)
- 이식 스크립트: packages/db/seed/import-pairings.ts. 검증: 108/110/851, 술당 페어링 ≥5.

## 작업 방식
- 각 Phase는 플랜 모드로 시작해 계획 확인 후 실행. 한 대화 = 한 Phase.
- Phase 완료 시 docs/05의 검증 체크리스트를 통과했는지 스스로 확인하고 결과를 보고.
- 실행·스크린샷 점검: 미니앱은 `pnpm --filter miniapp dev`(샌드박스 QR), web은 `pnpm --filter web dev`.
- 상태·용어: 주문 pending_payment→paid→preparing→shipped→delivered→confirmed / 예약 requested→confirmed|declined→visited|no_show|cancelled_*
```
