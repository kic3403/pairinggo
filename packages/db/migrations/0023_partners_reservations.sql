-- 0023 식당 예약 + 페어링GO 파트너 앱(2026-09-18, docs/21).
-- 사용자 결정: 파트너 가입은 신청 → 운영자 승인, 예약은 즉시 확정(사장님 수락 단계 없음), 매장 정보 수정은 바로 반영 + 변경 이력.
-- 규칙(상태 전이·예약 가능 시간)은 packages/shared/src/reservation, 최종 판정(정원·전이)은 아래 SQL 함수가 잠금을 걸고 한 번 더 한다.
-- RLS를 켜고 정책을 두지 않는다(지금처럼 서버의 service_role만 접근). 함수 실행 권한도 service_role에만.

-- ── 파트너(식당 사장님·직원) 계정 — 소비자 users와 따로(파트너 앱 자체 로그인)
create table if not exists partner_users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  password_hash  text not null,
  name           text not null,
  phone          text not null,
  failed_logins  int not null default 0,
  locked_until   timestamptz,
  created_at     timestamptz not null default now(),
  last_login_at  timestamptz
);

-- ── 매장 — 카카오 장소 id로 페어링GO 식당 검색 결과·place_info와 이어진다
create table if not exists merchants (
  id              uuid primary key default gen_random_uuid(),
  kakao_place_id  text not null unique,
  name            text not null,
  address         text not null default '',
  phone           text not null default '',          -- 매장 대표 번호(손님 예약 화면에 보인다)
  lat             double precision,
  lng             double precision,
  place_url       text,
  owner_name      text not null,
  biz_no          text not null,                      -- 사업자등록번호(숫자 10자리)
  status          text not null default 'applied' check (status in ('applied','approved','rejected','suspended')),
  reject_reason   text not null default '',
  approved_at     timestamptz,
  approved_by     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists merchants_status on merchants (status);

create table if not exists merchant_members (
  merchant_id      uuid not null references merchants(id) on delete cascade,
  partner_user_id  uuid not null references partner_users(id) on delete cascade,
  role             text not null default 'owner' check (role in ('owner','staff')),
  created_at       timestamptz not null default now(),
  primary key (merchant_id, partner_user_id)
);
create index if not exists merchant_members_user on merchant_members (partner_user_id);

-- 요일별 영업시간(0=일 … 6=토, 'HH:MM'). 닫는 시각 ≤ 여는 시각이면 자정 넘김 영업
create table if not exists merchant_hours (
  merchant_id  uuid not null references merchants(id) on delete cascade,
  weekday      smallint not null check (weekday between 0 and 6),
  closed       boolean not null default false,
  open         text not null default '11:00' check (open ~ '^[0-2][0-9]:[0-5][0-9]$'),
  close        text not null default '22:00' check (close ~ '^[0-2][0-9]:[0-5][0-9]$'),
  break_start  text check (break_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  break_end    text check (break_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  primary key (merchant_id, weekday)
);

create table if not exists merchant_closures (
  merchant_id  uuid not null references merchants(id) on delete cascade,
  day          date not null,
  note         text not null default '',
  primary key (merchant_id, day)
);

create table if not exists reservation_settings (
  merchant_id       uuid primary key references merchants(id) on delete cascade,
  accepting         boolean not null default false,
  slot_minutes      int not null default 30 check (slot_minutes in (15,30,60)),
  capacity_parties  int not null default 2 check (capacity_parties between 1 and 50),
  capacity_people   int not null default 0 check (capacity_people between 0 and 300),   -- 0 = 인원 제한 없음
  min_party         int not null default 1 check (min_party between 1 and 20),
  max_party         int not null default 8 check (max_party between 1 and 50),
  lead_minutes      int not null default 60 check (lead_minutes between 0 and 1440),
  horizon_days      int not null default 30 check (horizon_days between 1 and 90),
  room_bookable     boolean not null default false,
  notice            text not null default '',
  updated_at        timestamptz not null default now(),
  check (max_party >= min_party)
);

-- ── 예약 — 예약자 이름·번호는 예약 시점 스냅숏(매장에 제공, 손님 동의는 예약마다)
create table if not exists reservations (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,                 -- 짧은 예약번호(손님·매장이 부르는 번호)
  user_id          uuid references users(id) on delete set null,
  merchant_id      uuid not null references merchants(id) on delete cascade,
  visit_date       date not null,
  visit_time       text not null check (visit_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  visit_at         timestamptz not null,                 -- 한국 시간 visit_date + visit_time
  party_size       int not null check (party_size between 1 and 50),
  room_requested   boolean not null default false,
  bring_own_drink  boolean not null default false,
  drink_id         text,                                 -- 페어링GO에서 고른 조합
  food_id          text,
  note             text not null default '',
  guest_name       text not null,
  guest_phone      text not null,
  status           text not null default 'confirmed' check (status in ('confirmed','seated','completed','no_show','cancelled_by_user','cancelled_by_store')),
  cancel_reason    text not null default '',
  store_memo       text not null default '',             -- 매장만 보는 메모
  created_at       timestamptz not null default now(),
  seated_at        timestamptz,
  completed_at     timestamptz,
  cancelled_at     timestamptz,
  no_show_at       timestamptz,
  updated_at       timestamptz not null default now()
);
create index if not exists reservations_slot on reservations (merchant_id, visit_date, visit_time) where status in ('confirmed','seated');
create index if not exists reservations_merchant_day on reservations (merchant_id, visit_date);
create index if not exists reservations_user on reservations (user_id, visit_at desc);

create table if not exists reservation_events (
  id              bigserial primary key,
  reservation_id  uuid not null references reservations(id) on delete cascade,
  from_status     text,
  to_status       text not null,
  actor           text not null check (actor in ('user','store','admin','system')),
  actor_id        text,
  note            text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists reservation_events_res on reservation_events (reservation_id, created_at);

-- ── 손님 휴대폰 번호(문자 인증)
alter table users add column if not exists phone             text;
alter table users add column if not exists phone_verified_at timestamptz;

create table if not exists phone_verifications (
  id           bigserial primary key,
  user_id      uuid not null references users(id) on delete cascade,
  phone        text not null,
  code_hash    text not null,
  expires_at   timestamptz not null,
  attempts     int not null default 0,
  verified_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists phone_verifications_user on phone_verifications (user_id, created_at desc);
create index if not exists phone_verifications_phone on phone_verifications (phone, created_at desc);

-- ── 알림: 웹 푸시 구독(손님·파트너), 발송 기록(푸시·알림톡·문자)
create table if not exists push_subscriptions (
  id          bigserial primary key,
  owner_type  text not null check (owner_type in ('user','partner')),
  owner_id    uuid not null,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text not null default '',
  created_at  timestamptz not null default now(),
  last_ok_at  timestamptz
);
create index if not exists push_subscriptions_owner on push_subscriptions (owner_type, owner_id);

create table if not exists notifications (
  id              bigserial primary key,
  channel         text not null check (channel in ('push','alimtalk','sms')),
  target_type     text not null check (target_type in ('user','partner','merchant')),
  target_id       uuid,
  template        text not null,
  reservation_id  uuid references reservations(id) on delete set null,
  status          text not null check (status in ('sent','skipped','failed')),
  error           text not null default '',
  created_at      timestamptz not null default now()
);
create index if not exists notifications_created on notifications (created_at desc);

-- ── 매장 정보 변경 이력(파트너 수정은 바로 반영, 운영자가 보고 되돌린다)
create table if not exists merchant_changes (
  id               bigserial primary key,
  merchant_id      uuid not null references merchants(id) on delete cascade,
  partner_user_id  uuid references partner_users(id) on delete set null,
  section          text not null,                     -- info | hours | closures | settings
  before           jsonb,
  after            jsonb,
  reverted_at      timestamptz,
  reverted_by      text,
  created_at       timestamptz not null default now()
);
create index if not exists merchant_changes_merchant on merchant_changes (merchant_id, created_at desc);
create index if not exists merchant_changes_recent on merchant_changes (created_at desc);

alter table partner_users        enable row level security;
alter table merchants            enable row level security;
alter table merchant_members     enable row level security;
alter table merchant_hours       enable row level security;
alter table merchant_closures    enable row level security;
alter table reservation_settings enable row level security;
alter table reservations         enable row level security;
alter table reservation_events   enable row level security;
alter table phone_verifications  enable row level security;
alter table push_subscriptions   enable row level security;
alter table notifications        enable row level security;
alter table merchant_changes     enable row level security;

-- ── 예약 — 매장 예약 설정 행을 잠그고 그 슬롯의 확정·착석 팀·인원을 세어 정원 안이면 확정으로 넣는다.
-- 영업시간·휴무·당일 마감은 서버가 shared availableSlots로 먼저 거른다. 여기서는 동시 요청에도 정원을 넘지 않게 하는 것이 일.
-- 반환: {"ok":true,"id":…,"code":…} 또는 {"ok":false,"error":"not_accepting|merchant_unavailable|party_range|past|full|duplicate|too_many"}
create or replace function reserve(
  p_merchant uuid, p_user uuid, p_date date, p_time text, p_party int,
  p_room boolean, p_byo boolean, p_drink text, p_food text, p_note text,
  p_guest_name text, p_guest_phone text
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s          reservation_settings%rowtype;
  m_status   text;
  v_at       timestamptz;
  v_parties  int;
  v_people   int;
  v_code     text;
  v_id       uuid;
  alphabet   constant text := 'ACDEFGHJKLMNPQRTUVWXY34679';   -- 헷갈리는 글자(0/O, 1/I, 2/Z, 5/S, 8/B) 뺌
begin
  select * into s from reservation_settings where merchant_id = p_merchant for update;
  if not found or not s.accepting then return jsonb_build_object('ok', false, 'error', 'not_accepting'); end if;
  select status into m_status from merchants where id = p_merchant;
  if m_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'error', 'merchant_unavailable'); end if;
  if p_party < s.min_party or p_party > s.max_party then return jsonb_build_object('ok', false, 'error', 'party_range'); end if;
  if p_time !~ '^[0-2][0-9]:[0-5][0-9]$' then return jsonb_build_object('ok', false, 'error', 'past'); end if;
  v_at := (p_date::text || ' ' || p_time)::timestamp at time zone 'Asia/Seoul';
  if v_at <= now() then return jsonb_build_object('ok', false, 'error', 'past'); end if;

  if p_user is not null then
    -- 같은 매장·같은 날 확정 예약이 이미 있으면 막는다(중복 클릭·자리 선점 방지)
    if exists (select 1 from reservations where user_id = p_user and merchant_id = p_merchant and visit_date = p_date and status = 'confirmed') then
      return jsonb_build_object('ok', false, 'error', 'duplicate');
    end if;
    -- 한 사람이 동시에 잡아 둘 수 있는 앞으로의 확정 예약은 5건까지
    if (select count(*) from reservations where user_id = p_user and status = 'confirmed' and visit_at > now()) >= 5 then
      return jsonb_build_object('ok', false, 'error', 'too_many');
    end if;
  end if;

  select count(*), coalesce(sum(party_size), 0) into v_parties, v_people
    from reservations
   where merchant_id = p_merchant and visit_date = p_date and visit_time = p_time and status in ('confirmed','seated');
  if v_parties + 1 > s.capacity_parties or (s.capacity_people > 0 and v_people + p_party > s.capacity_people) then
    return jsonb_build_object('ok', false, 'error', 'full');
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from reservations where code = v_code);
  end loop;

  insert into reservations (code, user_id, merchant_id, visit_date, visit_time, visit_at, party_size, room_requested, bring_own_drink,
                            drink_id, food_id, note, guest_name, guest_phone)
  values (v_code, p_user, p_merchant, p_date, p_time, v_at, p_party, coalesce(p_room, false), coalesce(p_byo, false),
          nullif(p_drink, ''), nullif(p_food, ''), coalesce(p_note, ''), p_guest_name, p_guest_phone)
  returning id into v_id;
  insert into reservation_events (reservation_id, from_status, to_status, actor, actor_id)
  values (v_id, null, 'confirmed', 'user', p_user::text);
  return jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
end;
$$;

-- ── 상태 변경 — shared canTransition과 같은 규칙(방문 60분 전까지 손님 취소, 방문 15분 뒤부터 노쇼, 착석은 방문 2시간 전부터, 매장 취소는 사유 필수).
-- actor가 user면 본인 예약, store면 그 매장 소속 파트너만. 반환: {"ok":true,"from":…,"to":…} 또는 {"ok":false,"error":…}
create or replace function reservation_transition(
  p_id uuid, p_to text, p_actor text, p_actor_id text, p_note text default ''
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r      reservations%rowtype;
  staff  boolean := p_actor in ('store','admin');
  n      text := btrim(coalesce(p_note, ''));
begin
  select * into r from reservations where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p_actor = 'user' and (r.user_id is null or r.user_id::text is distinct from p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if p_actor = 'store' and not exists (select 1 from merchant_members where merchant_id = r.merchant_id and partner_user_id::text = p_actor_id) then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if r.status = p_to then return jsonb_build_object('ok', false, 'error', 'same_status'); end if;
  if r.status not in ('confirmed','seated') then return jsonb_build_object('ok', false, 'error', 'final'); end if;

  if p_to = 'seated' then
    if r.status <> 'confirmed' or not staff then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
    if now() < r.visit_at - interval '120 minutes' then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
    update reservations set status = 'seated', seated_at = now(), updated_at = now() where id = p_id;
  elsif p_to = 'completed' then
    if not staff then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
    if now() < r.visit_at - interval '120 minutes' then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
    update reservations set status = 'completed', completed_at = now(), seated_at = coalesce(seated_at, now()), updated_at = now() where id = p_id;
  elsif p_to = 'no_show' then
    if r.status <> 'confirmed' or not staff then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
    if now() < r.visit_at + interval '15 minutes' then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;
    update reservations set status = 'no_show', no_show_at = now(), updated_at = now() where id = p_id;
  elsif p_to = 'cancelled_by_user' then
    if r.status <> 'confirmed' or p_actor not in ('user','admin') then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
    if p_actor = 'user' and now() > r.visit_at - interval '60 minutes' then return jsonb_build_object('ok', false, 'error', 'too_late'); end if;
    update reservations set status = 'cancelled_by_user', cancelled_at = now(), cancel_reason = left(n, 100), updated_at = now() where id = p_id;
  elsif p_to = 'cancelled_by_store' then
    if r.status <> 'confirmed' or not staff then return jsonb_build_object('ok', false, 'error', 'not_allowed'); end if;
    if n = '' then return jsonb_build_object('ok', false, 'error', 'reason_required'); end if;
    update reservations set status = 'cancelled_by_store', cancelled_at = now(), cancel_reason = left(n, 100), updated_at = now() where id = p_id;
  else
    return jsonb_build_object('ok', false, 'error', 'not_allowed');
  end if;

  insert into reservation_events (reservation_id, from_status, to_status, actor, actor_id, note)
  values (p_id, r.status, p_to, p_actor, p_actor_id, left(n, 100));
  return jsonb_build_object('ok', true, 'from', r.status, 'to', p_to);
end;
$$;

-- ── 그날 슬롯별 잡힌 팀·인원(확정·착석) — 예약 가능 시간 화면용(PostgREST에서 group by를 못 써서 함수로)
create or replace function reservation_booked(p_merchant uuid, p_date date)
returns table (visit_time text, parties int, people int)
language sql stable
set search_path = public
as $$
  select visit_time, count(*)::int, coalesce(sum(party_size), 0)::int
    from reservations
   where merchant_id = p_merchant and visit_date = p_date and status in ('confirmed','seated')
   group by visit_time
$$;

revoke all on function reserve(uuid, uuid, date, text, int, boolean, boolean, text, text, text, text, text) from public, anon, authenticated;
revoke all on function reservation_transition(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function reservation_booked(uuid, date) from public, anon, authenticated;
grant execute on function reserve(uuid, uuid, date, text, int, boolean, boolean, text, text, text, text, text) to service_role;
grant execute on function reservation_transition(uuid, text, text, text, text) to service_role;
grant execute on function reservation_booked(uuid, date) to service_role;
