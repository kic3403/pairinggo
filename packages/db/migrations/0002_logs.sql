-- 0002 로그 — 미니앱 퍼널 이벤트 · 검색 로그 · 인기 검색어 집계 (서버(service_role)만 접근)

create table if not exists events (
  id          bigserial primary key,
  name        text not null,
  props       jsonb not null default '{}'::jsonb,
  session_id  text,
  client_ts   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists events_name_time on events (name, created_at desc);

create table if not exists search_logs (
  id            bigserial primary key,
  query_text    text not null,
  query_norm    text not null,
  kind          text not null default 'search',        -- search | search_intent | search_empty
  matched_type  text,                                  -- drink | food | browse | intent | null
  matched_id    text,
  session_id    text,
  created_at    timestamptz not null default now()
);
create index if not exists search_logs_time on search_logs (created_at desc);
create index if not exists search_logs_norm on search_logs (query_norm);

-- 인기 검색어: 최근 N일 검색 로그 집계 (크론이 refresh_popular_terms 호출)
create table if not exists popular_terms (
  term         text primary key,
  type         text not null,          -- drink | food | intent | empty
  matched_id   text,
  count        integer not null,
  computed_at  timestamptz not null default now()
);

create or replace function refresh_popular_terms(days integer default 30, top_n integer default 50)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  delete from popular_terms;
  insert into popular_terms (term, type, matched_id, count, computed_at)
  select query_norm,
         case when kind = 'search_empty' then 'empty' when kind = 'search_intent' then 'intent' else coalesce(matched_type, 'search') end,
         max(matched_id),
         count(*)::integer,
         now()
  from search_logs
  where created_at > now() - (days || ' days')::interval and length(query_norm) between 1 and 40
  group by query_norm, case when kind = 'search_empty' then 'empty' when kind = 'search_intent' then 'intent' else coalesce(matched_type, 'search') end
  order by count(*) desc
  limit top_n;
  get diagnostics n = row_count;
  return n;
end $$;

alter table events        enable row level security;
alter table search_logs   enable row level security;
alter table popular_terms enable row level security;
-- 정책 없음 = anon/authenticated 접근 불가, service_role만 (RLS 우회)
