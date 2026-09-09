-- 0001 카탈로그 — 술·음식·페어링·근거·메타 (docs/04 4-1)
create extension if not exists pg_trgm;

create table if not exists drinks (
  id              text primary key,
  slug            text not null,
  name            text not null,
  alias           text[] not null default '{}',
  chosung         text not null default '',
  category        text not null,
  abv             numeric(5,2),
  region          text not null default '',
  brewery_name    text not null default '',
  description     text not null default '',
  flavor_tags     text[] not null default '{}',
  profile         jsonb,
  awards          jsonb not null default '[]'::jsonb,
  is_generic      boolean not null default false,
  online_sellable boolean not null default true,
  buy_url         text,
  buy_store       text,
  offline         jsonb,
  trend           jsonb,
  blog_anju       integer not null default 0,
  merchant_id     text,                       -- Stage 2 입점 시 merchants.id
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists foods (
  id              text primary key,
  slug            text not null,
  name            text not null,
  alias           text[] not null default '{}',
  chosung         text not null default '',
  category        text not null,
  tags            text[] not null default '{}',
  profile         jsonb,
  search_keyword  text,                       -- 카카오 로컬 검색용 (Phase 3)
  trend           jsonb,
  is_new          boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists pairings (
  id              bigserial primary key,
  drink_id        text not null references drinks(id) on delete cascade,
  food_id         text not null references foods(id) on delete cascade,
  direction       text not null default 'both' check (direction in ('both','d2f','f2d')),
  expert_score    integer not null check (expert_score between 0 and 100),
  reason          text not null default '',
  blog_count      integer not null default 0,
  source_tier     text not null default 'profile' check (source_tier in ('official','sommelier','media','profile','ai')),
  status          text not null default 'curated' check (status in ('curated','ai','pending','hidden')),
  profile_score   jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (drink_id, food_id)
);

create table if not exists pairing_evidence (
  id              bigserial primary key,
  pairing_id      bigint not null references pairings(id) on delete cascade,
  source          text,
  url             text,
  quote           text,
  who             text,
  tier            text not null default 'media' check (tier in ('official','sommelier','media','profile','ai','user')),
  created_at      timestamptz not null default now()
);

-- 카탈로그 메타: version(발행 시각), counts
create table if not exists catalog_meta (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

create index if not exists drinks_name_trgm on drinks using gin (name gin_trgm_ops);
create index if not exists foods_name_trgm  on foods  using gin (name gin_trgm_ops);
create index if not exists drinks_chosung   on drinks (chosung);
create index if not exists foods_chosung    on foods (chosung);
create index if not exists drinks_category  on drinks (category);
create index if not exists pairings_drink   on pairings (drink_id);
create index if not exists pairings_food    on pairings (food_id);
create index if not exists evidence_pairing on pairing_evidence (pairing_id);

-- RLS: 카탈로그는 누구나 읽기, 쓰기는 service_role(서버)만
alter table drinks           enable row level security;
alter table foods            enable row level security;
alter table pairings         enable row level security;
alter table pairing_evidence enable row level security;
alter table catalog_meta     enable row level security;
do $$ begin
  create policy drinks_read   on drinks           for select using (true);
  create policy foods_read    on foods            for select using (true);
  create policy pairings_read on pairings         for select using (status <> 'hidden');
  create policy evidence_read on pairing_evidence for select using (true);
  create policy meta_read     on catalog_meta     for select using (true);
exception when duplicate_object then null; end $$;
