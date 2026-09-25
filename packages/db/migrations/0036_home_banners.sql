-- 0036 홈 배너(2026-09-25, docs/24) — 운영자가 만드는 카드 캐러셀: 이벤트(기간)·이달의 파트너(매장)·상시 안내. 되돌리기: drop table home_banners
create table if not exists home_banners (
  id          bigserial primary key,
  kind        text not null default 'event' check (kind in ('event','partner','report','custom')),
  title       text not null default '',
  subtitle    text not null default '',
  badge       text not null default '',
  cta         text not null default '보기',
  href        text not null default '',              -- 사이트 안 주소(/…)만
  tone        text not null default 'navy' check (tone in ('navy','orange','sand','mist','peach','green')),
  image_url   text,                                  -- 우리 저장소 공개 주소만
  merchant_id uuid references merchants(id) on delete set null,   -- kind=partner
  starts_on   date,
  ends_on     date,
  sort        integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists home_banners_active on home_banners (active, sort);
alter table home_banners enable row level security;
