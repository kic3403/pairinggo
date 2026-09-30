-- 전문가 3단계 배지(2026-09-30 사용자 결정) — 배지 1개 인증 전문가 · 2개 시니어 전문가 · 3개 마스터 전문가. 운영자가 정한다(기본 1)
-- 되돌리기: alter table experts drop column tier;
alter table experts add column if not exists tier smallint not null default 1 check (tier in (1, 2, 3));
