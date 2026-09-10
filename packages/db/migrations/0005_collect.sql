-- 0005 수집 도구 — 후보 큐에 수집 출처 종류·검색어·언급 수 추가, origin에 crawl 허용

alter table pairing_candidates drop constraint if exists pairing_candidates_origin_check;
alter table pairing_candidates add constraint pairing_candidates_origin_check
  check (origin in ('manual','sheet','search_log','ai','user','profile_rule','crawl'));

alter table pairing_candidates add column if not exists source_kind   text;      -- blog | cafe | news | youtube | sheet | brewery
alter table pairing_candidates add column if not exists query         text;      -- 수집에 쓴 검색어
alter table pairing_candidates add column if not exists mention_count integer not null default 1;
alter table pairing_candidates add column if not exists batch         text;      -- 수집·가져오기 배치 id (파일명·시각)

create index if not exists candidates_pair on pairing_candidates (drink_id, food_id, status);
create unique index if not exists candidates_dedupe on pairing_candidates (coalesce(drink_id, drink_raw), coalesce(food_id, food_raw), coalesce(url, ''));
