-- 0045 전문가 검수(2026-09-28, docs/27) — 회원이 전문가(소믈리에·요리연구가 등)를 신청하고 운영자가 승인하면 페어링을 판정한다.
-- 되돌리기: alter table pairings drop column expert_yes, drop column expert_no; drop table expert_reviews; drop table experts;

create table if not exists experts (
  user_id           uuid primary key references users(id) on delete cascade,
  status            text not null default 'applied' check (status in ('applied','approved','rejected','suspended')),
  real_name         text not null,                  -- 실명(공개)
  affiliation       text not null default '',       -- 소속(선택, 공개)
  title             text not null,                  -- 직함(shared EXPERT_TITLES 또는 직접 입력)
  display_name      text not null,                  -- 공개 표시명 — 기본 expertDisplayName(), 운영자가 승인 때 고칠 수 있다
  intro             text not null default '',       -- 짧은 소개(공개)
  doc_paths         text[] not null default '{}',   -- 비공개 버킷 expert-docs 경로(증빙 사진 ≤3) — 운영자만 서명 주소로 본다
  compensation      text not null default 'none' check (compensation in ('none','paid','sponsored')),  -- 테스트 기간 none, 출시 뒤 카드 표시용
  public_consent_at timestamptz not null,           -- "실명·소속 공개" 동의 시각(신청 때 필수)
  applied_at        timestamptz not null default now(),
  approved_at       timestamptz,
  reject_reason     text not null default '',
  reviews_count     integer not null default 0,     -- 표시용(저장·삭제 때 서버가 갱신)
  updated_at        timestamptz not null default now()
);
create index if not exists experts_status_idx on experts (status, applied_at desc);
alter table experts enable row level security;

-- 판정 원본(partner_pairings와 같은 구조). yes만 pairing_evidence 한 줄(evidence_id)을 만들고 neutral·no는 셈만 한다
create table if not exists expert_reviews (
  id           bigserial primary key,
  user_id      uuid not null references users(id) on delete cascade,
  drink_id     text not null references drinks(id) on delete cascade,
  food_id      text not null references foods(id) on delete cascade,
  verdict      text not null check (verdict in ('yes','neutral','no')),
  note         text not null default '',
  pairing_id   bigint references pairings(id) on delete set null,
  evidence_id  bigint references pairing_evidence(id) on delete set null,
  created      boolean not null default false,      -- 우리가 만든 pairings 행인가(삭제 때 되돌리기)
  prev         jsonb,                               -- 올리기 전 {tier, es, reason}
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, drink_id, food_id)
);
create index if not exists expert_reviews_pair_idx on expert_reviews (drink_id, food_id);
create index if not exists expert_reviews_user_idx on expert_reviews (user_id, updated_at desc);
alter table expert_reviews enable row level security;

-- 카드 배지용 집계(승인 전문가만) — 서버 recountExpert가 저장·삭제·정지 때 다시 센다. select("*")·export가 자동으로 실어 번들 Pairing.xp
alter table pairings add column if not exists expert_yes integer not null default 0;
alter table pairings add column if not exists expert_no  integer not null default 0;
