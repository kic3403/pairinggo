/**
 * 매장 메뉴판(2026-09-19) — 파트너가 사진으로 채운 메뉴(음식명·설명·가격)와 술(이름·용량·도수·가격).
 * 적혀 있지 않은 칸은 빈칸으로 둔다(지어내지 않음). 식당 카드의 "메뉴판 보기"와 예약 화면이 함께 쓴다.
 */
import { formatAbv, formatPrice, type DrinkItem, type MenuItem } from "@pairinggo/shared";

export default function MenuBoard({ menu, drinks }: { menu: MenuItem[]; drinks: DrinkItem[] }) {
  if (!menu.length && !drinks.length) return null;
  return (
    <div className="menu-board">
      {menu.length ? (
        <table>
          <caption>메뉴</caption>
          <thead><tr><th scope="col">음식</th><th scope="col" className="r">가격</th></tr></thead>
          <tbody>
            {menu.map((m, i) => (
              <tr key={`${m.name}-${i}`}>
                <td><span className="nm">{m.name}</span>{m.desc ? <span className="ds">{m.desc}</span> : null}</td>
                <td className="r">{formatPrice(m.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      {drinks.length ? (
        <table>
          <caption>술</caption>
          <thead><tr><th scope="col">술</th><th scope="col">용량</th><th scope="col" className="r">도수</th><th scope="col" className="r">가격</th></tr></thead>
          <tbody>
            {drinks.map((d, i) => (
              <tr key={`${d.name}-${d.volume}-${i}`}>
                <td><span className="nm">{d.name}</span></td>
                <td>{d.volume}</td>
                <td className="r">{formatAbv(d.abv)}</td>
                <td className="r">{formatPrice(d.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <p className="small muted">매장이 올린 메뉴판이에요. 가격·구성은 바뀔 수 있어요.</p>
    </div>
  );
}
