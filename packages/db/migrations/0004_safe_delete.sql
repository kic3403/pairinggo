-- 0004 Supabase의 safeupdate(WHERE 없는 DELETE 금지) 대응 — 집계 함수의 전체 삭제를 `where true`로

create or replace function refresh_popular_terms(days integer default 30, top_n integer default 50)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  delete from popular_terms where true;
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

create or replace function refresh_pairing_feedback(days integer default 90)
returns integer language plpgsql security definer as $$
declare n integer;
begin
  delete from pairing_feedback where true;
  insert into pairing_feedback (drink_id, food_id, card_taps, saves, buy_clicks, restaurant_clicks, computed_at)
  select d, f,
         count(*) filter (where name = 'card_tap'),
         count(*) filter (where name = 'save'),
         count(*) filter (where name = 'buy_link_click'),
         count(*) filter (where name = 'restaurant_link_click'),
         now()
  from (
    select name,
           coalesce(props->>'d', case when props->>'from' like 'drink:%' then split_part(props->>'from', ':', 2) when props->>'to' like 'drink:%' then split_part(props->>'to', ':', 2) end) as d,
           coalesce(props->>'f', case when props->>'from' like 'food:%'  then split_part(props->>'from', ':', 2) when props->>'to' like 'food:%'  then split_part(props->>'to', ':', 2) end) as f
    from events
    where created_at > now() - (days || ' days')::interval and name in ('card_tap','save','buy_link_click','restaurant_link_click')
  ) x
  where d is not null and f is not null and exists (select 1 from drinks where id = x.d) and exists (select 1 from foods where id = x.f)
  group by d, f;
  get diagnostics n = row_count;
  return n;
end $$;
