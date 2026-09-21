-- 0034 주문 알림 (2026-09-21, docs/22 §9)
-- notifications는 예약 전용이었다(reservation_id) — 주문 알림도 같은 표에 남겨 한곳에서 본다.
alter table notifications add column if not exists order_id uuid references orders(id) on delete set null;
create index if not exists notifications_order on notifications (order_id) where order_id is not null;
-- 판매자에게 "아직 안 보낸 주문" 독촉을 하루 한 번만 보내려고 마지막 발송 때를 적어 둔다
alter table order_items add column if not exists late_notified_at timestamptz;
