-- 사장님 리뷰 답글(2026-10-01) — 파트너가 자기 매장 리뷰에 답글 하나. 손님 화면에 "사장님 답글"로.
-- 되돌리기: alter table place_reviews drop column owner_reply, drop column owner_reply_at;
alter table place_reviews add column if not exists owner_reply    text;
alter table place_reviews add column if not exists owner_reply_at timestamptz;
