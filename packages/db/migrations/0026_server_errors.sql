-- 0026 운영 오류 기록(2026-09-19) — 외부 서비스 없이 서버 오류·주요 실패를 모아 어드민(/admin/errors)에서 본다.
-- 같은 오류(앱·위치·숫자 뺀 메시지)는 한 줄로 묶어 횟수만 센다. 개인정보는 넣지 않는다(메시지 300자·경로만).
create table if not exists server_errors (
  id           bigserial primary key,
  app          text not null,                    -- web · partner · web-client · partner-client
  place        text not null,                    -- 라우트 경로나 기능 이름(reserve, notify, cron …)
  message      text not null,
  fingerprint  text not null unique,
  count        int not null default 1,
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now(),
  sample       jsonb not null default '{}'::jsonb,  -- method·path·digest·stack 앞부분
  resolved_at  timestamptz
);
create index if not exists server_errors_last on server_errors (last_at desc);
alter table server_errors enable row level security;
