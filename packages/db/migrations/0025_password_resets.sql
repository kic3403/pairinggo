-- 0025 비밀번호 재설정(2026-09-19) — 휴대폰 문자 인증으로. 페어링GO 이메일 회원(인증한 번호)과 파트너 계정이 함께 쓴다.
-- 인증번호는 HMAC 해시로만 저장, 3분·5번까지, 하루 지나면 아침 크론이 지운다(개인정보처리방침 3번).
create table if not exists password_resets (
  id            bigserial primary key,
  account_type  text not null check (account_type in ('user','partner')),
  account_id    uuid not null,
  phone         text not null,
  code_hash     text not null,
  expires_at    timestamptz not null,
  attempts      int not null default 0,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists password_resets_account on password_resets (account_type, account_id, created_at desc);
alter table password_resets enable row level security;
