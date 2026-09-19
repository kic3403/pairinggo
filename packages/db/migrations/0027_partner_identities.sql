-- 0027 파트너 앱 간편로그인(2026-09-19) — 카카오·네이버 계정을 파트너 계정(partner_users)에 잇는다.
-- 한 파트너 계정에 카카오 하나·네이버 하나까지. 간편로그인으로만 가입한 계정은 password_hash에 쓸 수 없는 표시("oauth:…")를 둔다
-- (비밀번호 로그인은 안 되고, 원하면 비밀번호 찾기(문자 인증)로 비밀번호를 만들 수 있다).
create table if not exists partner_identities (
  provider         text not null check (provider in ('kakao','naver')),
  provider_uid     text not null,
  partner_user_id  uuid not null references partner_users(id) on delete cascade,
  email            text,
  created_at       timestamptz not null default now(),
  last_login_at    timestamptz,
  primary key (provider, provider_uid)
);
create unique index if not exists partner_identities_user_provider on partner_identities (partner_user_id, provider);
alter table partner_identities enable row level security;
