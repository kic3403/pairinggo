-- 0035 주종 확장(전통주·위스키·사케·와인) + 판매 규격·참고가격 (2026-09-24, docs/23)
-- 기존 행은 기본값(전통주·한국)으로 그대로. 되돌리기는 docs/23 §되돌리기(열·표 drop) 참고.

alter table drinks add column if not exists kind      text not null default 'trad' check (kind in ('trad','whisky','sake','wine'));
alter table drinks add column if not exists country   text not null default 'kr';        -- catalog/kinds.ts CountryDef.id
alter table drinks add column if not exists attrs     jsonb not null default '{}'::jsonb; -- 주종별 속성(AttrDef.key)
alter table drinks add column if not exists name_orig text;                               -- 원어명(라벨 표기)
alter table drinks add column if not exists is_demo   boolean not null default false;     -- 개발 데모 — 공개 카탈로그 제외
create index if not exists drinks_kind on drinks (kind);

-- 판매 규격: 같은 술도 용량·빈티지가 다르면 한 줄씩. 용량 미확인은 null(0 금지). 세트는 pack='set' + bottles(기본 한 병 필터에서 제외)
create table if not exists drink_specs (
  id         bigserial primary key,
  drink_id   text not null references drinks(id) on delete cascade,
  volume_ml  integer check (volume_ml is null or volume_ml > 0),
  abv        numeric(5,2) check (abv is null or (abv >= 0 and abv <= 80)),
  vintage    text,
  pack       text not null default 'bottle' check (pack in ('bottle','set')),
  bottles    integer not null default 1 check (bottles >= 1),
  note       text,
  sort       integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists drink_specs_drink on drink_specs (drink_id);

-- 참고가격: 그 규격 한 병 기준, 배송비·쿠폰 제외. 미확인은 행을 만들지 않는다(0원 금지). 옛 가격은 valid=false로 내린다
create table if not exists drink_prices (
  id          bigserial primary key,
  spec_id     bigint not null references drink_specs(id) on delete cascade,
  krw         integer not null check (krw > 0),
  price_type  text not null default 'retail' check (price_type in ('msrp','retail')),
  source      text not null,
  source_url  text,
  checked_on  date not null,
  valid       boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists drink_prices_spec on drink_prices (spec_id) where valid;

-- 페어링: 음용 방식(위스키 니트·하이볼, 사케 온·냉)과 근거 확인일
alter table pairings add column if not exists serve      text check (serve is null or serve in ('neat','rocks','highball','warm','cold'));
alter table pairings add column if not exists checked_on date;

alter table drink_specs  enable row level security;
alter table drink_prices enable row level security;
