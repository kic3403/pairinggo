-- 0012 수상 표에 요리 종류·가격대(공식 카드 표기)와 연도별 명단 범위 메모
alter table restaurant_awards add column if not exists cuisine text;
alter table restaurant_awards add column if not exists price   text;   -- ₩ ~ ₩₩₩₩

-- 연도별 명단이 전체인지 일부인지 — 화면에 "2024는 일부 명단" 같은 안내를 띄우기 위해
create table if not exists award_editions (
  guide     text not null,
  year      integer not null,
  edition   text,
  published date,
  coverage  text,          -- 예: "전체" / "스타 40곳만(빕 구르망 미포함)"
  source    text,
  updated_at timestamptz not null default now(),
  primary key (guide, year)
);
alter table award_editions enable row level security;
create policy "editions public read" on award_editions for select using (true);
