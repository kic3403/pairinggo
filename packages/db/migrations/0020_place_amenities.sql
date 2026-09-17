-- 0020 식당 편의 정보 — 구글 지도의 주차·단체·예약(parkingOptions·goodForGroups·reservable)을 평점과 같은 캐시에 둔다(2026-09-17).
-- null = 아직 받아 본 적 없음(이 컬럼이 생기기 전 캐시) → 다음 조회 때 한 번 다시 받는다. 받아 봤는데 정보가 없으면 {"parking":null,...}.
alter table place_ratings add column if not exists amenities jsonb;
