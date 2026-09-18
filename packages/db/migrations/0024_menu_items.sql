-- 0024 매장 메뉴판(2026-09-19 사용자 요청) — 파트너가 메뉴판 사진을 올리면 AI가 읽어 표로 채운다.
--   menu_items  [{ name, desc, price }]              음식명 · 간단한 설명 · 가격(원, 없으면 null)
--   drink_items [{ name, volume, abv, price }]       술 이름 · 용량 · 도수(%) · 가격
-- 적혀 있지 않은 값은 빈칸(""/null). 규칙은 packages/shared/src/menu-items.ts.
-- 기존 drink_ids·drink_names·food_ids·menu_names(카탈로그 연결)는 표에서 뽑아 함께 저장한다(식당 카드 "술·메뉴" 줄).
alter table place_info add column if not exists menu_items  jsonb not null default '[]'::jsonb;
alter table place_info add column if not exists drink_items jsonb not null default '[]'::jsonb;

-- 메뉴판 사진 읽기 기록 — AI 호출 비용 관리(매장당 하루 한도). 사진 자체는 저장하지 않는다
create table if not exists menu_reads (
  id               bigserial primary key,
  merchant_id      uuid references merchants(id) on delete cascade,
  partner_user_id  uuid references partner_users(id) on delete set null,
  images           int not null default 0,
  items            int not null default 0,
  ok               boolean not null default false,
  error            text not null default '',
  created_at       timestamptz not null default now()
);
create index if not exists menu_reads_merchant on menu_reads (merchant_id, created_at desc);
alter table menu_reads enable row level security;
