-- 0018 식당 평점 캐시 — 카카오 장소 id별 구글 지도 평점(2026-09-14). 구글 정책상 place ID 외 데이터는 30일까지만 보관 → fetched_at 기준으로 다시 받는다.
-- 대조 실패도 기록해(google_id null) 같은 가게를 매번 다시 묻지 않는다.
create table if not exists place_ratings (
  kakao_id   text primary key,
  google_id  text,
  rating     numeric(2,1),
  count      integer,
  fetched_at timestamptz not null default now()
);
alter table place_ratings enable row level security;
