-- 0033 정산 명세에 결제수수료 칸 (2026-09-21 사용자 결정, docs/22 §3)
-- 파트너가 내는 돈은 ① 페어링GO 앱 수수료 ② 결제대행사(PG) 수수료 둘이다.
-- 섞어 적으면 "누구에게 얼마를 냈는지" 알 수 없어 정산 문의가 늘어난다 — 명세에서 나눠 보여 준다.
alter table settlements add column if not exists pg_fee int not null default 0;
alter table settlements add column if not exists pg_fee_rate numeric(5,2) not null default 0;
comment on column settlements.fee is '페어링GO 앱 수수료(원)';
comment on column settlements.pg_fee is '결제대행사(PG) 수수료(원) — 회사 몫이 아니다';
