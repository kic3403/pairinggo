-- 0037 음식 사진(2026-09-26) — 상세 머리 카드 오른쪽 사진 칸·검색 결과 썸네일용.
-- 술과 같은 규칙(0009): 사용 허락을 받은 사진만(직접 촬영·라이선스 확인분). 어드민 /admin/foods에서 주소로 넣는다.
-- 되돌리기: alter table foods drop column image_url, drop column image_credit;
alter table foods add column if not exists image_url text;
alter table foods add column if not exists image_credit text;   -- 출처·저작권 표시
