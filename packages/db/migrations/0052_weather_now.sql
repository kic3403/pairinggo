-- 시·도별 지금 날씨(2026-10-02, docs/29) — 기상청 초단기실황을 시·도 대표 격자점마다 받아 두는 캐시.
-- 손님 요청마다 기상청을 부르지 않게 web lib/weather.ts가 60분 안 값은 그대로 쓰고, 오래됐을 때만 다시 받아 덮어쓴다(크론 없음).
-- 되돌리기: drop table weather_now;
create table if not exists weather_now (
  sido        text primary key,          -- 짧은 시·도 이름(shared situation.ts WEATHER_GRID 키)
  temp        numeric,                   -- 기온 ℃ (T1H)
  pty         integer not null default 0,-- 강수형태 코드(PTY: 0 없음·1 비·2 비/눈·3 눈·5 빗방울·6 빗방울눈날림·7 눈날림)
  rn1         numeric,                   -- 1시간 강수량 mm (RN1)
  observed_at timestamptz,               -- 관측 기준 시각(base_date+base_time, KST)
  fetched_at  timestamptz not null default now(),
  error       text                       -- 마지막 조회 실패 사유(성공하면 null)
);
alter table weather_now enable row level security;   -- 서비스 키로만 읽고 쓴다
