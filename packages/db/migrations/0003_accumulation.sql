-- 0003 페어링 데이터 축적 구조 — 출처 마스터 · 후보 큐 · 근거 보강 · 사용자 피드백 집계 · 카탈로그 스냅샷
-- (docs/02 데이터 파이프라인: 후보 수집 → 정규화 → 검수·승격 → 배포)

-- 출처 마스터: 매체·양조장·인물. 등급 기본값과 신뢰도
create table if not exists sources (
  id           bigserial primary key,
  name         text not null,
  domain       text,
  kind         text not null default 'media' check (kind in ('brewery','sommelier','media','blog','user','ai','other')),
  default_tier text not null default 'media' check (default_tier in ('official','sommelier','media','profile','ai','user')),
  reliability  smallint not null default 3 check (reliability between 1 and 5),
  note         text,
  created_at   timestamptz not null default now(),
  unique (name, domain)
);

-- 후보 큐: 아직 검수 전인 페어링 주장. 술/음식이 카탈로그에 없으면 raw 이름만 두고 matched_* 는 null
create table if not exists pairing_candidates (
  id             bigserial primary key,
  drink_raw      text,
  food_raw       text,
  drink_id       text references drinks(id) on delete set null,
  food_id        text references foods(id) on delete set null,
  source_id      bigint references sources(id) on delete set null,
  source_name    text,
  url            text,
  quote          text,
  who            text,
  suggested_tier text check (suggested_tier in ('official','sommelier','media','profile','ai','user')),
  suggested_score integer check (suggested_score between 0 and 100),
  suggested_reason text,
  origin         text not null default 'manual' check (origin in ('manual','sheet','search_log','ai','user','profile_rule')),
  status         text not null default 'draft' check (status in ('draft','needs_entity','rejected','promoted')),
  promoted_pairing_id bigint references pairings(id) on delete set null,
  reviewer       text,
  review_note    text,
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz
);
create index if not exists candidates_status on pairing_candidates (status, created_at desc);

-- 근거 보강: 출처 마스터 연결, 캡처 시각, Storage 스냅샷 경로 (링크가 죽어도 원문 보존)
alter table pairing_evidence add column if not exists source_id     bigint references sources(id) on delete set null;
alter table pairing_evidence add column if not exists captured_at   timestamptz;
alter table pairing_evidence add column if not exists snapshot_path text;      -- Supabase Storage: evidence/<id>.png|pdf
alter table pairing_evidence add column if not exists link_status   text;      -- ok | dead | soldout (check-links 결과)

-- 사용자 암묵 신호 집계 (events → 크론): 카드 탭·저장·구매 클릭. 종합 점수 보정 입력
create table if not exists pairing_feedback (
  drink_id     text not null references drinks(id) on delete cascade,
  food_id      text not null references foods(id) on delete cascade,
  card_taps    integer not null default 0,
  saves        integer not null default 0,
  buy_clicks   integer not null default 0,
  restaurant_clicks integer not null default 0,
  computed_at  timestamptz not null default now(),
  primary key (drink_id, food_id)
);

create or replace function refresh_pairing_feedback(days integer default 90)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  delete from pairing_feedback;
  insert into pairing_feedback (drink_id, food_id, card_taps, saves, buy_clicks, restaurant_clicks, computed_at)
  select d, f,
         count(*) filter (where name = 'card_tap'),
         count(*) filter (where name = 'save'),
         count(*) filter (where name = 'buy_link_click'),
         count(*) filter (where name = 'restaurant_link_click'),
         now()
  from (
    select name,
           coalesce(props->>'d', case when props->>'from' like 'drink:%' then split_part(props->>'from', ':', 2) when props->>'to' like 'drink:%' then split_part(props->>'to', ':', 2) end) as d,
           coalesce(props->>'f', case when props->>'from' like 'food:%'  then split_part(props->>'from', ':', 2) when props->>'to' like 'food:%'  then split_part(props->>'to', ':', 2) end) as f
    from events
    where created_at > now() - (days || ' days')::interval and name in ('card_tap','save','buy_link_click','restaurant_link_click')
  ) x
  where d is not null and f is not null and exists (select 1 from drinks where id = x.d) and exists (select 1 from foods where id = x.f)
  group by d, f;
  get diagnostics n = row_count;
  return n;
end $$;

-- 카탈로그 스냅샷: 발행 버전별 JSON 보관 (롤백·재현). 시드/발행 시 insert
create table if not exists catalog_snapshots (
  version      text primary key,
  counts       jsonb not null,
  data         jsonb not null,
  note         text,
  created_at   timestamptz not null default now()
);

alter table sources             enable row level security;
alter table pairing_candidates  enable row level security;
alter table pairing_feedback    enable row level security;
alter table catalog_snapshots   enable row level security;
do $$ begin
  create policy sources_read on sources for select using (true);   -- 출처명은 공개 (카드에 표시)
exception when duplicate_object then null; end $$;
-- 나머지는 정책 없음 = service_role만
