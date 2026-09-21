"use client";
/**
 * 입점 정보 · 배송 설정(docs/22 §3·§4-1) — 배송비·택배사는 양조장이 직접 정한다.
 * 주류 통신판매 승인 번호가 있어야 운영자가 입점을 승인할 수 있다(전통주 제조자만 통신판매 가능).
 */
import { useState } from "react";
import { APP_FEE, APP_FEE_TRIAL, COURIERS, COURIER_ETC, PG_FEE, TRIAL_MONTHS, cleanShippingPolicy, feeText, shippingLabel, type ShippingPolicy } from "@pairinggo/shared";

export type SellerFormValue = {
  status: "none" | "applied" | "approved" | "suspended";
  licenseNo: string; licenseAt: string; licenseNote: string;
  bizName: string; bizNo: string; ownerName: string; csPhone: string;
  fromAddr: string; returnAddr: string;
  bank: string; bankAccount: string; bankHolder: string;
  shipping: ShippingPolicy;
  feeRate: number;
};

const STATUS: Record<SellerFormValue["status"], { label: string; tone: string; hint: string }> = {
  none: { label: "입점 전", tone: "mute", hint: "아래를 채워 저장하면 입점 신청이 들어가요." },
  applied: { label: "승인 대기", tone: "warn", hint: "운영자가 주류 통신판매 승인 번호를 확인한 뒤 판매를 열어 드려요." },
  approved: { label: "판매중", tone: "ok", hint: "상품을 올리면 페어링GO 술 화면에서 바로 살 수 있어요." },
  suspended: { label: "판매 정지", tone: "bad", hint: "운영자에게 문의해 주세요. 정지 중에는 상품이 보이지 않아요." },
};

export function SellerForm({ initial }: { initial: SellerFormValue }) {
  const [f, setF] = useState(initial);
  const [state, setState] = useState<{ busy?: boolean; ok?: string; err?: string }>({});
  const s = f.shipping;
  const set = <K extends keyof SellerFormValue>(k: K) => (v: SellerFormValue[K]) => setF((p) => ({ ...p, [k]: v }));
  const setShip = <K extends keyof ShippingPolicy>(k: K, v: ShippingPolicy[K]) => setF((p) => ({ ...p, shipping: { ...p.shipping, [k]: v } }));
  const numOf = (v: string) => Math.max(0, Math.floor(Number(v.replace(/[^0-9]/g, "")) || 0));
  const st = STATUS[f.status];

  async function save() {
    setState({ busy: true });
    const body = {
      licenseNo: f.licenseNo, licenseAt: f.licenseAt, licenseNote: f.licenseNote,
      bizName: f.bizName, bizNo: f.bizNo, ownerName: f.ownerName, csPhone: f.csPhone,
      fromAddr: f.fromAddr, returnAddr: f.returnAddr, bank: f.bank, bankAccount: f.bankAccount, bankHolder: f.bankHolder,
      fee: s.fee, freeOver: s.freeOver, islandFee: s.islandFee, leadDays: s.leadDays, cold: s.cold,
      courierCode: s.courier.code, courierName: s.courier.name,
    };
    const r = await fetch("/api/seller", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const j = (await r?.json().catch(() => ({}))) as { error?: string; status?: SellerFormValue["status"] } | undefined;
    if (r?.ok) { setF((p) => ({ ...p, status: j?.status ?? p.status })); setState({ ok: f.status === "none" ? "입점 신청이 들어갔어요 — 운영자 확인 뒤 판매가 열려요" : "저장했어요" }); }
    else setState({ err: j?.error ?? "저장하지 못했어요" });
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>입점 상태 <span className={`chip ${st.tone}`}>{st.label}</span></h2>
          <span className="chip mute">{feeText(f.feeRate)}</span>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{st.hint}</p>
        <p className="small muted" style={{ margin: 0 }}>
          판매가(배송비 제외)에서 <b>앱 수수료</b>(페어링GO 몫 — 시범 {TRIAL_MONTHS}개월 {APP_FEE_TRIAL}%, 그 뒤 {APP_FEE}%)와
          <b> 결제수수료</b>({PG_FEE}% 내외 — 결제대행사 몫)를 나눠 뗍니다. 정산 명세에도 따로 적힙니다.
        </p>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>주류 통신판매 승인</h2>
        <p className="small muted" style={{ margin: 0 }}>
          전통주는 <b>제조자가 관할 세무서장의 승인</b>을 받아야 온라인으로 팔 수 있어요(통신판매 시작 15일 전 신청).
          승인 번호가 있어야 판매를 열어 드릴 수 있어요.
        </p>
        <label className="f">승인 번호
          <input value={f.licenseNo} onChange={(e) => set("licenseNo")(e.target.value)} placeholder="예: 서천-2026-01" maxLength={40} />
        </label>
        <label className="f">승인일
          <input type="date" value={f.licenseAt} onChange={(e) => set("licenseAt")(e.target.value)} />
        </label>
        <label className="f">덧붙일 말 <span className="hint">관할 세무서 등 운영자가 확인할 내용</span>
          <input value={f.licenseNote} onChange={(e) => set("licenseNote")(e.target.value)} maxLength={200} />
        </label>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>판매자 정보</h2>
        <p className="small muted" style={{ margin: 0 }}>상품·주문서에 <b>판매자</b>로 그대로 보여요(전자상거래법).</p>
        <label className="f">상호(사업자등록증)
          <input value={f.bizName} onChange={(e) => set("bizName")(e.target.value)} maxLength={60} />
        </label>
        <div className="grid2">
          <label className="f">사업자등록번호
            <input value={f.bizNo} onChange={(e) => set("bizNo")(e.target.value)} inputMode="numeric" placeholder="숫자 10자리" maxLength={12} />
          </label>
          <label className="f">대표자
            <input value={f.ownerName} onChange={(e) => set("ownerName")(e.target.value)} maxLength={30} />
          </label>
        </div>
        <label className="f">고객 문의 번호 <span className="hint">주문·배송 문의가 여기로 가요</span>
          <input type="tel" value={f.csPhone} onChange={(e) => set("csPhone")(e.target.value)} maxLength={20} />
        </label>
        <label className="f">출고지 주소
          <input value={f.fromAddr} onChange={(e) => set("fromAddr")(e.target.value)} maxLength={160} />
        </label>
        <label className="f">반품지 주소
          <input value={f.returnAddr} onChange={(e) => set("returnAddr")(e.target.value)} maxLength={160} />
        </label>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>배송 설정</h2>
        <p className="small muted" style={{ margin: 0 }}>
          배송비와 택배사는 <b>사장님이 정하세요</b>. 같은 매장 상품은 몇 개를 담아도 배송비가 한 번만 붙어요(묶음배송).
        </p>
        <div className="grid2">
          <label className="f">기본 배송비 <span className="hint">0원을 넣으면 무료배송</span>
            <input value={s.fee || ""} onChange={(e) => setShip("fee", numOf(e.target.value))} inputMode="numeric" placeholder="0" />
          </label>
          <label className="f">무료 배송 기준 <span className="hint">이 금액 이상이면 배송비 0 · 비우면 기준 없음</span>
            <input value={s.freeOver || ""} onChange={(e) => setShip("freeOver", numOf(e.target.value))} inputMode="numeric" placeholder="예: 30000" />
          </label>
        </div>
        <div className="grid2">
          <label className="f">제주·도서산간 추가비
            <input value={s.islandFee || ""} onChange={(e) => setShip("islandFee", numOf(e.target.value))} inputMode="numeric" placeholder="0" />
          </label>
          <label className="f">출고 소요일 <span className="hint">결제 뒤 며칠(영업일) 안에 보내는지</span>
            <select value={s.leadDays} onChange={(e) => setShip("leadDays", Number(e.target.value))}>
              {[0, 1, 2, 3, 4, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d === 0 ? "당일" : `${d}일`}</option>)}
            </select>
          </label>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.cold} onChange={(e) => setShip("cold", e.target.checked)} />
          <span>냉장 배송을 할 수 있어요 <span className="hint">생막걸리처럼 냉장이 필요한 술은 이걸 켜야 올릴 수 있어요. 여름철(6~9월)은 아이스박스로 보내 주세요.</span></span>
        </label>
        <div className="grid2">
          <label className="f">택배사
            <select
              value={COURIERS.some((c) => c.code === s.courier.code) ? s.courier.code : s.courier.name ? COURIER_ETC : ""}
              onChange={(e) => setShip("courier", e.target.value === COURIER_ETC ? { code: COURIER_ETC, name: "" } : { code: e.target.value, name: COURIERS.find((c) => c.code === e.target.value)?.name ?? "" })}
            >
              <option value="">고르기</option>
              {COURIERS.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              <option value={COURIER_ETC}>목록에 없어요 — 직접 적기</option>
            </select>
          </label>
          {s.courier.code === COURIER_ETC ? (
            <label className="f">택배사 이름 <span className="hint">배송 조회 링크는 붙지 않아요</span>
              <input value={s.courier.name} onChange={(e) => setShip("courier", { code: COURIER_ETC, name: e.target.value })} maxLength={20} placeholder="예: 우리동네택배" />
            </label>
          ) : null}
        </div>
        <p className="small muted" style={{ margin: 0 }}>손님 화면에는 <b>{shippingLabel(cleanShippingPolicy({ ...s, courierCode: s.courier.code, courierName: s.courier.name }))}</b>로 보여요.</p>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>정산 계좌</h2>
        <div className="grid2">
          <label className="f">은행<input value={f.bank} onChange={(e) => set("bank")(e.target.value)} maxLength={20} /></label>
          <label className="f">예금주<input value={f.bankHolder} onChange={(e) => set("bankHolder")(e.target.value)} maxLength={30} /></label>
        </div>
        <label className="f">계좌번호<input value={f.bankAccount} onChange={(e) => set("bankAccount")(e.target.value)} inputMode="numeric" maxLength={30} /></label>
      </section>

      {state.err ? <p className="err">{state.err}</p> : null}
      {state.ok ? <p className="okmsg">{state.ok}</p> : null}
      <button className="btn primary block" onClick={save} disabled={state.busy}>{state.busy ? "저장 중…" : f.status === "none" ? "입점 신청" : "저장"}</button>
    </div>
  );
}
