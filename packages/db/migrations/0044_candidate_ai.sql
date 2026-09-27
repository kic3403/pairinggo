-- 0044 근거 늘리기(2026-09-27, docs/26 §3-5 3단계) — 후보 글 AI 1차 선별 + 양조장 공식 페이지 추천 안주
-- 되돌리기: alter table pairing_candidates drop column ai_verdict, drop column ai_quote, drop column ai_reason, drop column ai_note, drop column ai_basis, drop column ai_model, drop column ai_checked_at;
--           drop table official_page_checks;

-- 판정: yes(어울린다는 말 + 인용문이 원문에 글자 그대로) · no(어울린다는 말이 없음 — 이름만 함께 나옴 등) · unclear(사람이 원문 확인)
--      · skip(원문을 읽었는데 두 이름이 가까이 나오지 않아 AI를 부르지 않음) · unreadable(원문·요약 모두 못 읽음)
alter table pairing_candidates add column if not exists ai_verdict    text check (ai_verdict in ('yes','no','unclear','skip','unreadable'));
alter table pairing_candidates add column if not exists ai_quote      text;          -- 원문에서 확인된 인용(승인 때 근거 인용으로 쓴다)
alter table pairing_candidates add column if not exists ai_reason     text;          -- 카드 추천 이유 초안(사람이 고칠 수 있음)
alter table pairing_candidates add column if not exists ai_note       text;
alter table pairing_candidates add column if not exists ai_basis      text;          -- page(원문) | snippet(검색 요약 — 카페처럼 원문을 못 읽을 때)
alter table pairing_candidates add column if not exists ai_model      text;
alter table pairing_candidates add column if not exists ai_checked_at timestamptz;
create index if not exists candidates_ai on pairing_candidates (status, ai_verdict);

-- 양조장 공식 페이지를 언제 읽었는지(같은 페이지를 매번 다시 부르지 않게) — 술 × 페이지 한 줄
create table if not exists official_page_checks (
  drink_id    text not null references drinks(id) on delete cascade,
  url         text not null,
  status      text not null,          -- found(추천 안주 있음) | none(없음) | blocked(robots·읽기 실패) | skipped(추천 낱말 없음)
  found       integer not null default 0,
  note        text,
  checked_at  timestamptz not null default now(),
  primary key (drink_id, url)
);
alter table official_page_checks enable row level security;
