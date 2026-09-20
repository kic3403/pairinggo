-- 0032 전통주 구매 — 중개(입점) 1차 (2026-09-21, docs/22)
-- 사용자 결정: 직접 매입 판매은 보류하고 중개부터. 판매자는 양조장(merchants.kind='brewery', 주류 통신판매 승인 보유),
-- 배송·CS도 양조장. 페어링GO는 통신판매중개자 + 수단제공자 — 주류를 자기 책임으로 사거나 팔지 않는다.
-- 배송비·택배사는 양조장이 직접 정한다(규칙은 packages/shared/src/shop). 수수료는 시범 3개월 0% → 5%.
-- RLS는 켜고 정책을 두지 않는다(서버 service_role만 접근).

-- ── 판매자 = 입점 양조장. merchants 한 곳당 하나
create table if not exists sellers (
  id                uuid primary key default gen_random_uuid(),
  merchant_id       uuid not null unique references merchants(id) on delete cascade,
  status            text not null default 'applied' check (status in ('applied','approved','suspended')),
  -- 주류 통신판매 승인(관할 세무서장) — 없으면 승인하지 않는다
  license_no        text not null default '',
  license_at        date,
  license_note      text not null default '',
  biz_name          text not null default '',        -- 사업자등록증 상호(판매자 신원 고지, 전자상거래법 §20)
  biz_no            text not null default '',
  owner_name        text not null default '',
  cs_phone          text not null default '',
  -- 배송 정책 (shared cleanShippingPolicy)
  ship_fee          int not null default 0,
  ship_free_over    int not null default 0,
  ship_island_fee   int not null default 0,
  ship_lead_days    int not null default 2,
  ship_cold         boolean not null default false,
  courier_code      text not null default '',
  courier_name      text not null default '',
  from_addr         text not null default '',        -- 출고지
  return_addr       text not null default '',        -- 반품지
  -- 정산
  fee_rate          numeric(5,2) not null default 0, -- 중개 수수료 % (시범 0)
  bank              text not null default '',
  bank_account      text not null default '',
  bank_holder       text not null default '',
  note              text not null default '',        -- 운영자 메모(비공개)
  approved_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists sellers_status on sellers (status);

-- ── 상품 — 카탈로그 술(drinks.id)에 연결. 같은 술도 용량·구성이 다르면 다른 상품
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references sellers(id) on delete cascade,
  drink_id     text not null,
  name         text not null,
  volume       text not null default '',
  abv          numeric(4,1),
  price        int not null check (price >= 0),
  list_price   int not null default 0,
  stock        int not null default 0 check (stock >= 0),
  per_order    int not null default 0,               -- 한 주문 최대 수량(0 = 제한 없음)
  cold         boolean not null default false,       -- 냉장 배송 필요(생막걸리)
  ship_free    boolean not null default false,       -- 이 상품만 무료배송
  photos       jsonb not null default '[]'::jsonb,
  descr        text not null default '',
  status       text not null default 'selling' check (status in ('selling','soldout','off')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists products_drink on products (drink_id) where status = 'selling';
create index if not exists products_seller on products (seller_id);

-- ── 장바구니 (회원당 하나, 기기가 바뀌어도 남는다)
create table if not exists cart_items (
  user_id      uuid not null references users(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  qty          int not null default 1 check (qty > 0),
  added_at     timestamptz not null default now(),
  primary key (user_id, product_id)
);

-- ── 주문 — 결제 1건. 여러 양조장 상품을 한 번에 살 수 있고 배송은 양조장별로 나간다
create table if not exists orders (
  id             uuid primary key default gen_random_uuid(),
  order_no       text not null unique,               -- YYMMDD + 영숫자 6
  user_id        uuid references users(id) on delete set null,
  status         text not null default 'paid' check (status in ('paid','confirmed','shipped','delivered','done','cancelled','returned')),
  -- 금액
  items_total    int not null default 0,
  ship_total     int not null default 0,
  total          int not null default 0,
  -- 결제(PG) — 계약 전에는 비어 있다(결제 없이 주문을 만들지 않는다)
  pay_provider   text not null default '',
  pay_key        text not null default '',
  pay_method     text not null default '',
  paid_at        timestamptz,
  -- 받는 분(주문 시점 스냅숏) — 판매자에게 제공된다
  recv_name      text not null default '',
  recv_phone     text not null default '',
  recv_zip       text not null default '',
  recv_addr1     text not null default '',
  recv_addr2     text not null default '',
  recv_memo      text not null default '',
  island         boolean not null default false,
  -- 만 19세·성인 확인 기록, 주문마다 받는 판매자 제공 동의
  adult_checked_at timestamptz,
  consent_version  text not null default '',
  cancel_reason  text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists orders_user on orders (user_id, created_at desc);
create index if not exists orders_status on orders (status, created_at desc);

-- ── 주문 줄 — 이름·가격은 주문 시점 스냅숏(나중에 상품이 바뀌어도 주문서는 그대로)
create table if not exists order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  seller_id    uuid not null references sellers(id),
  product_id   uuid references products(id) on delete set null,
  drink_id     text not null default '',
  name         text not null,
  volume       text not null default '',
  price        int not null,
  qty          int not null check (qty > 0),
  cold         boolean not null default false,
  status       text not null default 'paid' check (status in ('paid','confirmed','shipped','delivered','done','cancelled','returned')),
  cancel_reason text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists order_items_order on order_items (order_id);
create index if not exists order_items_seller on order_items (seller_id, status, created_at desc);

-- ── 배송 — 주문 × 양조장 하나당 한 건(묶음배송)
create table if not exists shipments (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references orders(id) on delete cascade,
  seller_id     uuid not null references sellers(id),
  ship_fee      int not null default 0,
  courier_code  text not null default '',
  courier_name  text not null default '',
  invoice       text not null default '',
  shipped_at    timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (order_id, seller_id)
);

-- ── 재고 변동 이력(주문·취소·수기 조정)
create table if not exists stock_logs (
  id          bigserial primary key,
  product_id  uuid not null references products(id) on delete cascade,
  delta       int not null,
  reason      text not null default '',
  order_id    uuid references orders(id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists stock_logs_product on stock_logs (product_id, at desc);

-- ── 월 정산 명세(1차는 수기 확인, 2차에서 자동화)
create table if not exists settlements (
  id           uuid primary key default gen_random_uuid(),
  seller_id    uuid not null references sellers(id) on delete cascade,
  period       text not null,                        -- 'YYYY-MM'
  sales        int not null default 0,
  cancels      int not null default 0,
  fee_rate     numeric(5,2) not null default 0,
  fee          int not null default 0,
  payout       int not null default 0,
  status       text not null default 'draft' check (status in ('draft','sent','paid')),
  note         text not null default '',
  created_at   timestamptz not null default now(),
  unique (seller_id, period)
);

alter table sellers      enable row level security;
alter table products     enable row level security;
alter table cart_items   enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;
alter table shipments    enable row level security;
alter table stock_logs   enable row level security;
alter table settlements  enable row level security;

-- ── 주문 만들기 — 재고를 잠그고 확인한 뒤 줄·배송을 만든다(동시 주문에 재고가 음수가 되지 않게).
-- p_lines: [{product_id, qty}], p_ship: [{seller_id, ship_fee}]
create or replace function place_order(
  p_order_no text, p_user uuid, p_lines jsonb, p_ship jsonb,
  p_recv jsonb, p_island boolean, p_consent text
) returns uuid
language plpgsql
as $$
declare
  v_order uuid;
  v_line jsonb;
  v_prod record;
  v_qty int;
  v_items int := 0;
  v_ship int := 0;
begin
  insert into orders (order_no, user_id, recv_name, recv_phone, recv_zip, recv_addr1, recv_addr2, recv_memo, island, consent_version, adult_checked_at)
  values (p_order_no, p_user, p_recv->>'name', p_recv->>'phone', p_recv->>'zip', p_recv->>'addr1', p_recv->>'addr2', p_recv->>'memo', coalesce(p_island, false), p_consent, now())
  returning id into v_order;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_qty := (v_line->>'qty')::int;
    select p.*, s.id as s_id, s.status as s_status into v_prod
      from products p join sellers s on s.id = p.seller_id
     where p.id = (v_line->>'product_id')::uuid
     for update of p;
    if v_prod is null then raise exception 'PRODUCT_GONE'; end if;
    if v_prod.status <> 'selling' or v_prod.s_status <> 'approved' then raise exception 'NOT_SELLING:%', v_prod.name; end if;
    if v_prod.stock < v_qty then raise exception 'OUT_OF_STOCK:%', v_prod.name; end if;
    if v_prod.per_order > 0 and v_qty > v_prod.per_order then raise exception 'OVER_LIMIT:%', v_prod.name; end if;

    update products set stock = stock - v_qty, status = case when stock - v_qty <= 0 then 'soldout' else status end, updated_at = now() where id = v_prod.id;
    insert into stock_logs (product_id, delta, reason, order_id) values (v_prod.id, -v_qty, 'order', v_order);
    insert into order_items (order_id, seller_id, product_id, drink_id, name, volume, price, qty, cold)
    values (v_order, v_prod.seller_id, v_prod.id, v_prod.drink_id, v_prod.name, v_prod.volume, v_prod.price, v_qty, v_prod.cold);
    v_items := v_items + v_prod.price * v_qty;
  end loop;

  if v_items = 0 then raise exception 'EMPTY_ORDER'; end if;

  for v_line in select * from jsonb_array_elements(p_ship) loop
    insert into shipments (order_id, seller_id, ship_fee)
    values (v_order, (v_line->>'seller_id')::uuid, coalesce((v_line->>'ship_fee')::int, 0))
    on conflict (order_id, seller_id) do update set ship_fee = excluded.ship_fee;
    v_ship := v_ship + coalesce((v_line->>'ship_fee')::int, 0);
  end loop;

  update orders set items_total = v_items, ship_total = v_ship, total = v_items + v_ship, updated_at = now() where id = v_order;
  delete from cart_items where user_id = p_user and product_id in (select (x->>'product_id')::uuid from jsonb_array_elements(p_lines) x);
  return v_order;
end;
$$;

-- ── 주문(또는 한 양조장 몫)을 취소하고 재고를 되돌린다
create or replace function cancel_order_items(p_order uuid, p_seller uuid, p_reason text)
returns int
language plpgsql
as $$
declare
  v_item record;
  v_n int := 0;
begin
  for v_item in
    select * from order_items
     where order_id = p_order and (p_seller is null or seller_id = p_seller) and status in ('paid','confirmed')
     for update
  loop
    update order_items set status = 'cancelled', cancel_reason = coalesce(p_reason, ''), updated_at = now() where id = v_item.id;
    if v_item.product_id is not null then
      update products set stock = stock + v_item.qty, status = case when status = 'soldout' then 'selling' else status end, updated_at = now() where id = v_item.product_id;
      insert into stock_logs (product_id, delta, reason, order_id) values (v_item.product_id, v_item.qty, 'cancel', p_order);
    end if;
    v_n := v_n + 1;
  end loop;
  update orders o set
    status = case when not exists (select 1 from order_items i where i.order_id = o.id and i.status <> 'cancelled') then 'cancelled' else o.status end,
    cancel_reason = case when p_seller is null then coalesce(p_reason, '') else o.cancel_reason end,
    updated_at = now()
  where o.id = p_order;
  return v_n;
end;
$$;

revoke all on function place_order(text, uuid, jsonb, jsonb, jsonb, boolean, text) from public;
revoke all on function cancel_order_items(uuid, uuid, text) from public;
