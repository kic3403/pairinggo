-- 0039 없는 술 추가 요청(2026-09-26, docs/25 §5) — 검색·라벨 사진으로 못 찾은 술을 회원(또는 비회원)이 요청한다.
-- 운영자가 /admin/wanted에서 등록됨(drink_id)·보류로 처리하면 요청한 회원은 마이페이지에서 본다.
-- 되돌리기: drop table drink_requests;
create table if not exists drink_requests (
  id           bigserial primary key,
  user_id      uuid references users(id) on delete cascade,     -- 비회원 요청은 null
  query        text not null,                                    -- 요청한 술 이름(2~60자)
  memo         text not null default '',                        -- 양조장·어디서 봤는지 등(140자)
  source       text not null default 'search' check (source in ('search', 'label')),
  status       text not null default 'open' check (status in ('open', 'done', 'rejected')),
  drink_id     text references drinks(id) on delete set null,   -- 등록됐을 때 연결한 술
  admin_note   text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists drink_requests_status_idx on drink_requests (status, created_at desc);
create index if not exists drink_requests_user_idx on drink_requests (user_id, created_at desc);
alter table drink_requests enable row level security;
