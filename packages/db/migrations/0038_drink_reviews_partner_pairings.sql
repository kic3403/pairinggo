-- 0038 술 평가(별점·한줄평) + 파트너 페어링 입력 (2026-09-26, docs/25)
-- 되돌리기: drop table partner_pairings; drop table drink_reviews;

-- 회원당 술 하나에 평가 하나(수정·삭제 가능). 탈퇴는 cascade. 공개 목록에는 닉네임·별점·글·날짜만.
create table if not exists drink_reviews (
  id             bigserial primary key,
  drink_id       text not null references drinks(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  stars          smallint not null check (stars between 1 and 5),
  body           text not null default '',
  status         text not null default 'active' check (status in ('active', 'hidden')),
  hidden_reason  text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (drink_id, user_id)
);
create index if not exists drink_reviews_drink_idx on drink_reviews (drink_id, status);
create index if not exists drink_reviews_user_idx  on drink_reviews (user_id, created_at);
alter table drink_reviews enable row level security;

-- 양조장 파트너가 적은 "우리 술 × 음식" — pairings 행을 만들거나(created) 기존 행을 official로 올린다(prev = 되돌릴 스냅샷).
create table if not exists partner_pairings (
  id           bigserial primary key,
  merchant_id  uuid not null references merchants(id) on delete cascade,
  drink_id     text not null references drinks(id) on delete cascade,
  food_id      text not null references foods(id) on delete cascade,
  note         text not null default '',
  pairing_id   bigint references pairings(id) on delete set null,
  evidence_id  bigint references pairing_evidence(id) on delete set null,
  created      boolean not null default false,          -- 우리가 pairings 행을 새로 만들었는지(지우면 행도 지움)
  prev         jsonb,                                    -- 기존 행의 {tier, es, reason} — 지우면 이 값으로 되돌림
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (merchant_id, drink_id, food_id)
);
create index if not exists partner_pairings_drink_idx on partner_pairings (drink_id);
alter table partner_pairings enable row level security;
