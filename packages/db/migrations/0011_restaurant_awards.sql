-- 0011 식당 수상 표 — 미쉐린 가이드(스타·빕구르망) 등. 카카오 로컬 결과에 배지를 붙일 때 이름+좌표로 대조한다.
-- 매년 새 가이드가 나오면 research/michelin-YYYY.json 을 만들고 `pnpm --filter @pairinggo/db awards <파일>` 로 그 연도 행을 통째로 갈아 끼운다(docs/17).
-- 로고는 쓰지 않는다(상표). 화면은 자체 별 아이콘 + "미쉐린 가이드 서울&부산 {year}" 출처 표기.
create table if not exists restaurant_awards (
  id         bigserial primary key,
  guide      text not null,                       -- michelin (블루리본은 데이터 계약 뒤에)
  year       integer not null,
  city       text not null,                       -- 서울 | 부산
  name       text not null,
  name_norm  text not null,                       -- 띄어쓰기·기호 제거, 소문자
  kind       text not null check (kind in ('star', 'bib', 'green', 'selected')),
  level      integer not null default 0,          -- star면 1~3, 나머지 0
  lat        double precision,
  lng        double precision,
  url        text,                                -- 가이드 상세 페이지
  created_at timestamptz not null default now(),
  unique (guide, year, city, name_norm, kind)
);
create index if not exists restaurant_awards_lookup on restaurant_awards (guide, year, name_norm);

alter table restaurant_awards enable row level security;
create policy "awards public read" on restaurant_awards for select using (true);   -- 공개 데이터(수상 사실) — 읽기 허용, 쓰기는 service_role
