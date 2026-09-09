# 페어링GO

술을 검색하면 어울리는 음식을, 음식을 검색하면 어울리는 전통주를 — 근거와 함께. 토스 앱인토스 미니앱.

## 시작

```bash
corepack enable          # pnpm
pnpm install
pnpm test                # packages/shared 유닛 테스트
pnpm dev                 # apps/miniapp (vite --host) → 샌드박스 앱에서 intoss://pairinggo
pnpm build               # apps/miniapp/dist (앱인토스 콘솔 업로드용)
```

## 구조

| 경로 | 내용 |
|---|---|
| `apps/miniapp` | Vite + React 미니앱 (정적 번들) |
| `packages/shared` | 데이터·검색 엔진·페어링 점수·유사도 (Vitest) |
| `docs/` | 기획·설계·로드맵 문서 (00~07) |
| `scripts/check-links.mjs` | 주간 구매 링크 점검 |

계획과 규칙: [CLAUDE.md](CLAUDE.md), [docs/05 로드맵](docs/05_개발로드맵_Phase별.md)
