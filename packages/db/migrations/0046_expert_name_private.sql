-- 0046 전문가 검수 보완(2026-09-28 사용자 결정) — 실명 공개는 선택(비공개면 닉네임으로 표시), 직함은 여러 개 + 직접 입력.
-- 되돌리기: alter table experts drop column titles, drop column name_public, drop column pen_name;
alter table experts add column if not exists titles      text[]  not null default '{}';   -- 직함 목록(EXPERT_TITLES 또는 직접 입력, 최대 4). title 칸은 "·"로 이은 표시용
alter table experts add column if not exists name_public boolean not null default true;   -- false면 카드에 실명 대신 pen_name
alter table experts add column if not exists pen_name    text    not null default '';     -- 비공개일 때 보일 닉네임(2~12자)
update experts set titles = array[title] where cardinality(titles) = 0 and title <> '';
