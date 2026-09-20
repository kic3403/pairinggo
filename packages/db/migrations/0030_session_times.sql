-- 0030 회차제 예약 (2026-09-20 사용자 요청: 양조장 시음은 정해진 시간에 회차로 받는다)
-- session_times 가 비어 있으면 지금처럼 영업시간을 slot_minutes 로 나눈다.
alter table reservation_settings add column if not exists session_times   text[] not null default '{}';
alter table reservation_settings add column if not exists session_minutes integer not null default 0;
