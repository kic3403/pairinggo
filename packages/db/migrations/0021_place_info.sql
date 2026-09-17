-- 0021 운영자가 확인한 식당 정보 — 주차·콜키지·룸·취급 전통주·대표 메뉴(2026-09-17).
-- 콜키지·룸·메뉴는 공개 API에 없고 화면 수집은 약관 위반이라 운영자가 직접 확인해 /admin/places에서 적는다. 제휴 식당이 직접 입력하면 source 'partner'.
-- 카카오 장소 id로 식당 검색 결과에 붙인다. 이름·주소·좌표는 어드민 목록용으로 저장 시점 값을 함께 둔다(카카오를 다시 부르지 않게).
create table if not exists place_info (
  kakao_id      text primary key,
  name          text not null,
  address       text,
  phone         text,
  lat           double precision,
  lng           double precision,
  place_url     text,
  parking       text check (parking in ('free','paid','valet','street','none')),
  parking_note  text not null default '',
  corkage       text check (corkage in ('yes','no')),
  corkage_note  text not null default '',
  room          text check (room in ('yes','no')),
  room_note     text not null default '',
  drink_ids     text[] not null default '{}',
  food_ids      text[] not null default '{}',
  menu_note     text not null default '',
  memo          text not null default '',          -- 운영 메모(화면에 안 보임): 통화한 사람, 다시 확인할 것 등
  source        text not null default 'operator' check (source in ('operator','partner')),
  verified_at   date,
  updated_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists place_info_drinks on place_info using gin (drink_ids);
create index if not exists place_info_foods on place_info using gin (food_ids);
alter table place_info enable row level security;
