-- 0041 회원 푸시 설정 + 주간 소식 보낸 시각 (2026-09-26, docs/25 §7 — 재방문 알림)
-- 되돌리기: alter table users drop column push_pref, drop column weekly_push_at;
alter table users add column if not exists push_pref      jsonb not null default '{"weekly": true, "activity": true}'::jsonb;   -- 주간 소식 · 활동 소식
alter table users add column if not exists weekly_push_at timestamptz;   -- 마지막 주간 소식(크론이 6일 안에 두 번 보내지 않게)
