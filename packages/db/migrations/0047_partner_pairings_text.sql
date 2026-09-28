-- 0047 파트너 페어링 확장(2026-09-29 사용자 결정) — 음식은 직접 입력(적은 글자가 원본), 식당 파트너도 페어링(술도 글자).
-- 카탈로그와 자동 연결되면 drink_id·food_id가 채워지고 pairings에 official 근거, 아니면 글자만(추천 칸·검색에 보임).
-- 되돌리기: delete from partner_pairings where drink_id is null or food_id is null;
--           alter table partner_pairings drop constraint partner_pairings_text_key, drop column food_text, drop column drink_text, drop column food_key, drop column drink_key;
--           alter table partner_pairings alter column food_id set not null, alter column drink_id set not null, add unique (merchant_id, drink_id, food_id);
alter table partner_pairings add column if not exists food_text  text not null default '';
alter table partner_pairings add column if not exists drink_text text not null default '';
alter table partner_pairings add column if not exists food_key   text not null default '';   -- shared normFoodText(food_text)
alter table partner_pairings add column if not exists drink_key  text not null default '';   -- 양조장은 drink_id, 식당은 normFoodText(drink_text)
alter table partner_pairings alter column food_id drop not null;
alter table partner_pairings alter column drink_id drop not null;

-- 기존 행(카탈로그 음식으로 적은 것) — 이름을 글자로 옮긴다
update partner_pairings p set food_text = f.name from foods f where p.food_id = f.id and p.food_text = '';
update partner_pairings p set drink_text = d.name from drinks d where p.drink_id = d.id and p.drink_text = '';
update partner_pairings set food_key = lower(regexp_replace(regexp_replace(food_text, '\([^)]*\)', '', 'g'), '[^가-힣a-zA-Z0-9]', '', 'g')) where food_key = '';
update partner_pairings set drink_key = coalesce(drink_id, lower(regexp_replace(drink_text, '[^가-힣a-zA-Z0-9]', '', 'g'))) where drink_key = '';

alter table partner_pairings drop constraint if exists partner_pairings_merchant_id_drink_id_food_id_key;
alter table partner_pairings add constraint partner_pairings_text_key unique (merchant_id, drink_key, food_key);
create index if not exists partner_pairings_food_idx on partner_pairings (food_id);
