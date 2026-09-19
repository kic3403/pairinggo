-- 0028 매장 상세·대표 사진·방문 인증 리뷰(2026-09-19 사용자 결정 A: 방문 인증 리뷰만)
-- 대표 사진: 파트너가 올린 매장 사진(최대 10장, menu-photos 버킷 공개 주소) — 매장 상세 맨 위
alter table place_info add column if not exists photos jsonb not null default '[]'::jsonb;

-- 리뷰: 카카오 장소 id 기준(파트너가 아닌 식당도). 방문 인증(예약 방문 완료 또는 영수증) 없이는 쓸 수 없다.
-- 방문 한 번에 하나: 예약 id·영수증 해시가 고유. 가게 이름·주소는 쓸 때의 값을 함께 둔다(카카오는 id로 다시 찾을 수 없어서).
create table if not exists place_reviews (
  id              bigserial primary key,
  kakao_id        text not null,
  place_name      text not null,
  place_address   text not null default '',
  user_id         uuid not null references users(id) on delete cascade,
  rating          smallint not null check (rating between 1 and 5),
  body            text not null,
  photos          jsonb not null default '[]'::jsonb,
  verify_kind     text not null check (verify_kind in ('reservation', 'receipt')),
  reservation_id  uuid unique references reservations(id) on delete set null,
  receipt_hash    text unique,
  visit_date      date not null,
  status          text not null default 'active' check (status in ('active', 'hidden')),
  report_count    integer not null default 0,
  hidden_reason   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists place_reviews_place on place_reviews (kakao_id, status, created_at desc);
create index if not exists place_reviews_user on place_reviews (user_id, created_at desc);
create index if not exists place_reviews_reported on place_reviews (status, report_count desc) where report_count > 0;

-- 신고: 한 회원이 한 리뷰에 한 번. 3건이면 자동 숨김(앱 코드) → 운영자 /admin/reviews
create table if not exists review_reports (
  review_id   bigint not null references place_reviews(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  reason      text not null default '',
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
);

-- 영수증 읽기 기록(하루 횟수 제한·오류 확인용) — 영수증 사진·읽은 내용은 남기지 않는다
create table if not exists receipt_reads (
  id          bigserial primary key,
  user_id     uuid not null references users(id) on delete cascade,
  kakao_id    text not null,
  ok          boolean not null,
  error       text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists receipt_reads_user on receipt_reads (user_id, created_at desc);

alter table place_reviews  enable row level security;
alter table review_reports enable row level security;
alter table receipt_reads  enable row level security;
