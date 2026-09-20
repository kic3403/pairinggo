-- 0029 파트너 종류 (2026-09-20 사용자 결정: 어드민에서 식당·양조장·리쿼샵 세 갈래로 나눈다)
-- restaurant 식당(지금까지의 파트너, 자리 예약) · brewery 양조장(방문 시음·직접 판매) · liquor 리쿼샵(취급 전통주·매장 픽업)
-- 이미 있는 매장은 모두 식당으로 둔다 — 운영자가 어드민에서 바꿀 수 있다.
alter table merchants add column if not exists kind text not null default 'restaurant';
do $$ begin
  alter table merchants add constraint merchants_kind_check check (kind in ('restaurant','brewery','liquor'));
exception when duplicate_object then null; end $$;
create index if not exists merchants_kind on merchants (kind, status);
