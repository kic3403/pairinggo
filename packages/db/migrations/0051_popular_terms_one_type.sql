-- 인기 검색어 집계 고침(2026-10-01) — 같은 검색어가 두 갈래(예: 한 번은 찾음·한 번은 결과 없음, 식당으로 찾음)로 잡히면
-- popular_terms(term 기본키)에 두 줄을 넣으려다 중복 키 오류로 집계 전체가 실패했다. 검색어마다 가장 많은 갈래 하나만 남긴다.
-- 되돌리기: 0004_safe_delete.sql의 refresh_popular_terms 정의를 다시 실행.
create or replace function refresh_popular_terms(days integer default 30, top_n integer default 50)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  delete from popular_terms where true;
  insert into popular_terms (term, type, matched_id, count, computed_at)
  select term, type, matched_id, cnt, now()
  from (
    select distinct on (term) term, type, matched_id, cnt
    from (
      select query_norm as term,
             case when kind = 'search_empty' then 'empty' when kind = 'search_intent' then 'intent' else coalesce(matched_type, 'search') end as type,
             max(matched_id) as matched_id,
             count(*)::integer as cnt
      from search_logs
      where created_at > now() - (days || ' days')::interval and length(query_norm) between 1 and 40
      group by 1, 2
    ) g
    order by term, cnt desc, (type = 'empty') asc
  ) one
  order by cnt desc
  limit top_n;
  get diagnostics n = row_count;
  return n;
end $$;
