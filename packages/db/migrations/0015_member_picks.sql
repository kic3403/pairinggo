-- 0015 회원 추천 페어링 (docs/18 이후 2026-09-13) — 회원이 "이 술엔 이 음식"을 제안한다.
--   status: active(정상 — 같은 조합이 MEMBER_PICK_MIN명 모이면 공개) · review(카탈로그에 없는 술/음식을 적음 → 어드민 지정 후 공개) · hidden(운영자 숨김)
--   공개 조건이 되면 pairings에 source_tier 'user' 행을 만든다(lib/member-picks.ts materialize). 회원 한 명이 같은 조합에 한 번만.
create table if not exists member_picks (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  drink_id    text references drinks(id) on delete cascade,
  food_id     text references foods(id) on delete cascade,
  drink_raw   text,                                   -- 카탈로그에 없는 술 이름(검수용)
  food_raw    text,                                   -- 카탈로그에 없는 음식 이름(검수용)
  note        text not null default '' check (char_length(note) <= 140),
  image_url   text,                                   -- Supabase Storage(member-picks) 공개 URL, 1장
  status      text not null default 'active' check (status in ('active','review','hidden')),
  review_note text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (drink_id is not null or drink_raw is not null),
  check (food_id is not null or food_raw is not null)
);
create unique index if not exists member_picks_once on member_picks (user_id, drink_id, food_id) where drink_id is not null and food_id is not null;
create index if not exists member_picks_pair on member_picks (drink_id, food_id) where status = 'active';
create index if not exists member_picks_user on member_picks (user_id, created_at desc);
alter table member_picks enable row level security;

-- 페어링·근거 출처 등급에 user(회원 추천) 허용 — 근거·후보에는 0006에서 이미 있음
alter table pairings drop constraint if exists pairings_source_tier_check;
alter table pairings add constraint pairings_source_tier_check check (source_tier in ('official','sommelier','media','blog','profile','ai','user'));
