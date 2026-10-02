-- 날씨 소식 푸시(2026-10-02, docs/29 §5-2) — 마지막으로 보낸 시각(크론이 20시간 안에 두 번 보내지 않게). 설정은 users.push_pref.weather(0041 jsonb).
-- 되돌리기: alter table users drop column weather_push_at;
alter table users add column if not exists weather_push_at timestamptz;
