-- 0007 소셜 로그인 사용자 + 저장 목록
-- 카카오·네이버·구글 간편로그인(Auth.js). 개인정보는 최소만 — 공급자 식별자·닉네임·이메일.
-- 주의: 이메일·닉네임은 개인정보다. 로그인 기능을 공개하기 전에 개인정보처리방침과 수집 동의가 있어야 한다.

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  provider      text not null check (provider in ('kakao', 'naver', 'google')),
  provider_uid  text not null,                       -- 공급자가 주는 고유 식별자
  email         text,                                -- 공급자가 제공하지 않을 수 있음
  name          text,                                -- 닉네임
  avatar_url    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  unique (provider, provider_uid)
);
create index if not exists users_email_idx on users (email) where email is not null;

-- 저장(찜) — 로그인하면 기기가 바뀌어도 남는다. 비로그인은 브라우저 로컬에만 저장한다.
create table if not exists saved_items (
  user_id    uuid not null references users (id) on delete cascade,
  kind       text not null check (kind in ('drink', 'food')),
  item_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, item_id)
);
create index if not exists saved_items_user_idx on saved_items (user_id, created_at desc);

-- 나머지 테이블과 같은 원칙: RLS 켜고 정책 없음 = service_role(서버)만 접근
alter table users       enable row level security;
alter table saved_items enable row level security;
