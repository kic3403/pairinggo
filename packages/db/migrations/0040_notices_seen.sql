-- 0040 공지 + 알림 읽은 시각 (2026-09-26, docs/25 §6 — 헤더 알림 버튼: 공지·활동)
-- 되돌리기: drop table notices; alter table users drop column notif_seen_at;
create table if not exists notices (
  id          bigserial primary key,
  kind        text not null default 'notice' check (kind in ('notice', 'event', 'update')),   -- 공지 · 이벤트 · 업데이트
  title       text not null,
  body        text not null default '',
  href        text not null default '',          -- 사이트 안 주소(/…) 또는 https
  starts_on   date,                              -- 비어 있으면 바로
  ends_on     date,                              -- 비어 있으면 계속
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists notices_active_idx on notices (active, created_at desc);
alter table notices enable row level security;

-- 회원이 알림 패널을 연 시각 — 그 뒤에 생긴 활동만 배지에 센다(공지는 기기별 localStorage)
alter table users add column if not exists notif_seen_at timestamptz;
