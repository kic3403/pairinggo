/**
 * 매장 메뉴판(2026-09-19) — 파트너가 채운 메뉴(사진·음식명·설명·가격)와 술(사진·이름·용량·도수·가격).
 * 한 줄 = [사진] 이름 / 설명(술은 "750ml · 13%") … 가격. 사진·빈칸은 적힌 것만 보인다(지어내지 않음).
 * 식당 카드의 "메뉴판 보기"와 예약 화면이 함께 쓴다.
 */
import { formatAbv, formatPrice, type DrinkItem, type MenuItem } from "@pairinggo/shared";

type Row = { key: string; name: string; sub: string; price: number | null; img?: string };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) return null;
  const photos = rows.some((r) => r.img);
  return (
    <section className="mb-sec" aria-label={title}>
      <h4>{title} <span>{rows.length}</span></h4>
      <ul className={`mb-list${photos ? " has-photos" : ""}`}>
        {rows.map((r) => (
          <li key={r.key} className="mb-row">
            {photos ? (r.img ? <img className="mb-img" src={r.img} alt={r.name} loading="lazy" decoding="async" width={72} height={72} /> : <span className="mb-img empty" aria-hidden="true" />) : null}
            <div className="mb-body">
              <span className="nm">{r.name}</span>
              {r.sub ? <span className="ds">{r.sub}</span> : null}
            </div>
            <span className="mb-price">{formatPrice(r.price)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function MenuBoard({ menu, drinks }: { menu: MenuItem[]; drinks: DrinkItem[] }) {
  if (!menu.length && !drinks.length) return null;
  const food: Row[] = menu.map((m, i) => ({ key: `m${i}-${m.name}`, name: m.name, sub: m.desc, price: m.price, img: m.img }));
  const drink: Row[] = drinks.map((d, i) => ({ key: `d${i}-${d.name}-${d.volume}`, name: d.name, sub: [d.volume, formatAbv(d.abv)].filter(Boolean).join(" · "), price: d.price, img: d.img }));
  return (
    <div className="menu-board">
      <Section title="메뉴" rows={food} />
      <Section title="술" rows={drink} />
      <p className="small muted">매장이 올린 메뉴판이에요. 가격·구성은 바뀔 수 있어요.</p>
    </div>
  );
}

/** 카드 "메뉴판 보기" 옆 작은 사진 줄 — 사진이 있는 매장만(최대 4장) */
export function MenuThumbs({ menu, drinks }: { menu: MenuItem[]; drinks: DrinkItem[] }) {
  const imgs = [...menu, ...drinks].filter((x) => x.img).slice(0, 4);
  if (!imgs.length) return null;
  return <span className="mb-thumbs" aria-hidden="true">{imgs.map((x, i) => <img key={i} src={x.img} alt="" loading="lazy" decoding="async" width={34} height={34} />)}</span>;
}
