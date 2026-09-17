-- 0022 식당 정보 보강(2026-09-17 사용자 요청) — 술·메뉴를 "추가" 버튼으로 하나씩 넣는다: 카탈로그에 있으면 id(drink_ids·food_ids), 없으면 적은 이름 그대로.
-- contact_phone은 운영자 전용 대표 번호(공개 화면·공개 API에 내보내지 않는다). naver_url은 네이버 지도 링크(데이터를 가져오지 않고 링크만 건다).
alter table place_info add column if not exists drink_names   text[] not null default '{}';
alter table place_info add column if not exists menu_names    text[] not null default '{}';
alter table place_info add column if not exists contact_phone text   not null default '';
alter table place_info add column if not exists naver_url     text;
