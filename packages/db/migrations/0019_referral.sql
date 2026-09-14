-- 0019 추천인 — 가입 때 추천인 닉네임을 적으면 users.referred_by에 그 회원 id를 둔다(2026-09-15, docs/19 A1·docs/20 P1-2).
-- 지인 배포에서 누가 누구를 데려왔는지(확산) 보기 위해. 마이페이지에 "초대한 친구 N명". 포인트·현금성 보상은 없다.
alter table users add column if not exists referred_by uuid references users(id) on delete set null;
alter table users add column if not exists referred_at timestamptz;
create index if not exists users_referred_by_idx on users (referred_by) where referred_by is not null;
