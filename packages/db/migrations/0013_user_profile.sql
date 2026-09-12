-- 0013 회원 프로필(성별·생년월일·사는 시도) + 로그에 회원 id
-- 지인 배포에서 "누가 어떤 조합을 찾는지"를 성별·연령대·지역별로 보기 위해. 개인정보처리방침에 수집 항목·목적을 적어야 한다(docs/15 A2).
alter table users add column if not exists gender     text check (gender in ('m', 'f'));
alter table users add column if not exists birth_date date;
alter table users add column if not exists sido       text;    -- 시·도 이름(packages/shared/src/profile.ts SIDO_OPTIONS)
alter table users add column if not exists profile_at timestamptz;   -- 프로필을 채운 시각

alter table events      add column if not exists user_id uuid references users(id) on delete set null;
alter table search_logs add column if not exists user_id uuid references users(id) on delete set null;
create index if not exists events_user_idx      on events (user_id, created_at desc);
create index if not exists search_logs_user_idx on search_logs (user_id, created_at desc);
