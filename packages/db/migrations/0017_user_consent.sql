-- 0017 가입 동의 기록 — 이용약관·개인정보 수집·이용·만 19세 이상 확인(모두 필수)
-- 버전은 packages/shared/src/consent.ts CONSENT_VERSION. 약관·방침이 바뀌어 버전이 오르면 기존 회원도 다음 방문 때 다시 동의한다.
-- 소셜 로그인은 계정 연결(users 행 생성) 뒤 /profile 에서 동의를 받는다 — 동의 전 행은 consent_version 이 null.
alter table users add column if not exists consent_version text;
alter table users add column if not exists consent_at      timestamptz;
