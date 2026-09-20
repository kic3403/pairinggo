-- 0031 양조장 파트너 ↔ 카탈로그 양조장 연결 (2026-09-20 사용자 요청)
-- 양조장 파트너가 "우리 양조장"을 고르면 그 양조장의 전통주가 매장 화면에 보이고,
-- 술 상세에서 "양조장 방문 시음 예약"으로 이어진다. 카탈로그 drinks.brewery_name 과 같은 이름을 담는다.
alter table merchants add column if not exists brewery text not null default '';
create index if not exists merchants_brewery on merchants (brewery) where brewery <> '';
