-- 0010 채널별 언급량 일일 기록 — "많이 찾는 전통주" 순위의 원자료
-- 매일 00:00(KST) 크론이 술마다 최근 30일 언급 수를 채널별로 세어 한 행씩 남긴다.
-- 채널: naver(네이버 블로그 글 수) · youtube(유튜브 영상 수) · google(구글 검색 블로그 페이지 수) · insta(인스타그램 해시태그 게시물 수, 수동 입력)
-- 순위 계산은 packages/shared/src/trend.ts (채널별 최댓값 = 100으로 정규화 → 채널 평균).
create table if not exists drink_mentions_daily (
  day         date        not null,                 -- 집계일(KST)
  drink_id    text        not null references drinks(id) on delete cascade,
  channel     text        not null check (channel in ('naver', 'youtube', 'google', 'insta')),
  count       integer     not null check (count >= 0),
  window_days integer     not null default 30,      -- 며칠 치를 셌는지
  capped      boolean     not null default false,   -- API 상한(네이버 1,000·유튜브 100)에 걸려 실제보다 적을 수 있음
  query       text,                                 -- 검색에 쓴 문자열
  raw         jsonb,                                -- 응답 부가 정보(total 추정치 등)
  created_at  timestamptz not null default now(),
  primary key (day, drink_id, channel)
);
create index if not exists drink_mentions_daily_drink_idx on drink_mentions_daily (drink_id, channel, day desc);

alter table drink_mentions_daily enable row level security;   -- service_role만 접근(정책 없음)
