-- 0048 파트너 사업자등록증(2026-09-29 사용자 결정) — 매장·양조장·리쿼샵은 사업자등록증 사진 필수(가입 때, 이미 가입한 매장은 매장 정보 화면에서).
-- 사진은 비공개 버킷 partner-docs/{매장 id 또는 가입 폴더}/ — 운영자만 서명 주소로 본다. 승인하려면 한 장 이상 있어야 한다.
-- 되돌리기: alter table merchants drop column biz_doc_paths, drop column biz_doc_at;
alter table merchants add column if not exists biz_doc_paths text[] not null default '{}';
alter table merchants add column if not exists biz_doc_at    timestamptz;
