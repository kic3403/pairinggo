-- 0006 출처 등급에 blog(블로그·카페 후기) 추가 — media보다 낮고 profile보다 높은 등급

alter table sources drop constraint if exists sources_default_tier_check;
alter table sources add constraint sources_default_tier_check check (default_tier in ('official','sommelier','media','blog','profile','ai','user'));

alter table pairing_candidates drop constraint if exists pairing_candidates_suggested_tier_check;
alter table pairing_candidates add constraint pairing_candidates_suggested_tier_check check (suggested_tier in ('official','sommelier','media','blog','profile','ai','user'));

alter table pairing_evidence drop constraint if exists pairing_evidence_tier_check;
alter table pairing_evidence add constraint pairing_evidence_tier_check check (tier in ('official','sommelier','media','blog','profile','ai','user'));

alter table pairings drop constraint if exists pairings_source_tier_check;
alter table pairings add constraint pairings_source_tier_check check (source_tier in ('official','sommelier','media','blog','profile','ai'));
