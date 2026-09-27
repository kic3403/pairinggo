-- 0042 허수 제거(2026-09-27, docs/26 §3-3) — 근거 링크·인용문 검증 + 대중 언급 lift
-- 되돌리기: alter table pairing_evidence drop column checked_at, drop column fail_count, drop column quote_ok, drop column check_note;
--           alter table pairings drop column blog_lift; drop table name_totals;

-- 근거 검증(크론 /api/cron/evidence · 스크립트 evidence-check). link_status(0003에 있던 칸)를 쓴다:
--   ok(열리고 인용문도 있음) · quote_missing(열리는데 인용문이 없음) · dead(404·410·연결 실패) · blocked(403·로그인·스크립트 화면이라 못 읽음) · unverifiable(원래 못 읽는 곳 — 카페·공공데이터 등)
alter table pairing_evidence add column if not exists checked_at timestamptz;
alter table pairing_evidence add column if not exists fail_count integer not null default 0;   -- dead·quote_missing이 연속으로 나온 횟수(ok면 0)
alter table pairing_evidence add column if not exists quote_ok   boolean;                      -- 인용문이 페이지에 있었나(null = 못 봄)
alter table pairing_evidence add column if not exists check_note text;
create index if not exists pairing_evidence_checked on pairing_evidence (checked_at nulls first);

-- 대중 언급 lift — 이름 단독 검색 수(흔한 이름일수록 큼)로 조합 언급 수를 나눈 연관도의 백분위(0~1). 언급 3건 미만은 0
alter table pairings add column if not exists blog_lift real;
create table if not exists name_totals (
  kind        text not null check (kind in ('drink', 'food')),
  name        text not null,
  total       bigint,
  checked_on  date not null default current_date,
  primary key (kind, name)
);
alter table name_totals enable row level security;
