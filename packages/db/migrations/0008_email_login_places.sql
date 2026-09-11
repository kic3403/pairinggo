-- 0008 이메일 회원가입/로그인 + 음식점 저장
-- 소셜(카카오·네이버·구글)에 더해 이메일·비밀번호 가입을 받는다. 비밀번호는 scrypt 해시(Node 내장)로만 저장한다.
-- 저장(찜) 대상에 음식점(place)을 추가한다. 음식점은 카탈로그에 없고 카카오 로컬에서 오므로 meta에 이름·주소를 함께 둔다.

/* ---------- 사용자 ---------- */
alter table users add column if not exists password_hash text;          -- 이메일 가입만 사용
alter table users add column if not exists failed_attempts int not null default 0;
alter table users add column if not exists locked_until timestamptz;     -- 연속 실패 시 잠금

alter table users drop constraint if exists users_provider_check;
alter table users add constraint users_provider_check check (provider in ('kakao', 'naver', 'google', 'email'));

-- 이메일 가입은 이메일이 곧 식별자다. 같은 이메일로 두 번 가입할 수 없게 한다(대소문자 무시)
create unique index if not exists users_email_login_unique on users (lower(email)) where provider = 'email';

/* ---------- 저장(찜) ---------- */
alter table saved_items drop constraint if exists saved_items_kind_check;
alter table saved_items add constraint saved_items_kind_check check (kind in ('drink', 'food', 'place'));

-- 음식점은 카탈로그에 없으므로 표시에 필요한 값을 함께 저장한다 (이름·주소·전화·카카오 링크·좌표)
alter table saved_items add column if not exists meta jsonb;
