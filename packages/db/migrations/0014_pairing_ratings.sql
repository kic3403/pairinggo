-- 0014 '먹어봤어요' 평가 — 회원이 실제로 먹어 본 조합에 어울렸다 · 보통 · 별로를 남긴다.
-- 한 회원은 한 조합에 한 번(바꾸면 덮어씀). 요약 규칙은 packages/shared/src/pairing/ratings.ts.
-- 페어링 행이 아니라 (술, 음식)으로 묶는다 — 검수 중(pending) 조합이나 나중에 다시 만든 조합에도 평가가 이어지게.
create table if not exists pairing_ratings (
  id         bigserial primary key,
  user_id    uuid not null references users(id) on delete cascade,
  drink_id   text not null references drinks(id) on delete cascade,
  food_id    text not null references foods(id) on delete cascade,
  rating     text not null check (rating in ('good', 'ok', 'bad')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, drink_id, food_id)
);
create index if not exists pairing_ratings_drink_idx on pairing_ratings (drink_id);
create index if not exists pairing_ratings_food_idx  on pairing_ratings (food_id);

alter table pairing_ratings enable row level security;   -- service_role만 접근(정책 없음). 공개 화면에는 서버가 집계만 준다
