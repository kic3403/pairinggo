-- 0016 회원 추천 글 하트 (2026-09-14, 사용자 결정: 글은 바로 보이고 하트 수로 공감을 보여 준다)
create table if not exists member_pick_likes (
  pick_id    bigint not null references member_picks(id) on delete cascade,
  user_id    uuid   not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pick_id, user_id)
);
create index if not exists member_pick_likes_pick on member_pick_likes (pick_id);
alter table member_pick_likes enable row level security;
