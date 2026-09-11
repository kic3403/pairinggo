-- 0009 술 이미지 URL
-- 홈 배너·카드에 쓸 제품 사진. 사용 허락을 받은 이미지만 넣는다(양조장 제공, 직접 촬영, 라이선스 확인분).
-- 더술닷컴(aT) 사진은 공공누리 4유형(상업적 이용 금지)이라 쓰지 않는다.
alter table drinks add column if not exists image_url text;
alter table drinks add column if not exists image_credit text;   -- 출처·저작권 표시 (예: "복순도가 제공")
