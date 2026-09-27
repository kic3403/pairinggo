-- 0043 대중 언급 lift의 종류 기준 수(예: "막걸리 해물파전", "막걸리")도 name_totals에 둔다(2026-09-27, docs/26 §3-3)
-- 되돌리기: delete from name_totals where kind = 'base'; 그리고 아래 제약을 ('drink','food')로
alter table name_totals drop constraint if exists name_totals_kind_check;
alter table name_totals add constraint name_totals_kind_check check (kind in ('drink', 'food', 'base'));
