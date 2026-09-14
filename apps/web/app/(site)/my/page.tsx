/** 마이페이지 — 저장한 전통주·음식·음식점. 캐치테이블·데일리샷처럼 탭으로 나눠 본다. */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { D, F, byDrink, byFood, scorePairings, suggestTried, toSlug } from "@pairinggo/shared";
import { auth, signOut } from "@/auth";
import { getCatalog } from "@/lib/catalog";
import { KIND_LABEL, SAVED_KINDS, listSaved, type SavedKind } from "@/lib/saved";
import { getProfile, referralInfo } from "@/lib/account";
import { myRatings } from "@/lib/ratings";
import TriedCard from "../_components/TriedCard";
import { myPicks } from "@/lib/member-picks";
import { memberPickStatusText } from "@pairinggo/shared";
import { ageBand } from "@pairinggo/shared";
import Heart from "../_components/Heart";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "마이페이지 | 페어링GO", robots: { index: false } };

export default async function MyPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=%2Fmy");

  const sp = await searchParams;
  const tab = (SAVED_KINDS as string[]).includes(sp.tab || "") ? (sp.tab as SavedKind) : "drink";

  await getCatalog();
  const [rows, profile, picks, rated, referral] = await Promise.all([listSaved(uid), getProfile(uid), myPicks(uid).catch(() => []), myRatings(uid).catch(() => new Set<string>()), referralInfo(uid).catch(() => ({ invited: 0, referred: false }))]);
  // 먹어봤나요? — 저장한 술·음식으로 아직 평가하지 않은 조합 3개(docs/20 P1-1). 정렬은 상세 화면과 같은 규칙
  const tried = suggestTried({
    savedDrinks: rows.filter((r) => r.kind === "drink").map((r) => r.item_id), savedFoods: rows.filter((r) => r.kind === "food").map((r) => r.item_id),
    rated, byDrink, byFood, rank: (p) => scorePairings(p, (x) => D[x.d]?.category || "").map((s) => s.p),
  }).map((t) => ({ ...t, drink: D[t.d]?.name ?? t.d, food: F[t.f]?.name ?? t.f }));
  const count = (k: SavedKind) => rows.filter((r) => r.kind === k).length;
  const current = rows.filter((r) => r.kind === tab);

  return (
    <div className="wrap">
      <h1>마이페이지</h1>
      <div className="meta">
        <span><b>{profile?.name || "회원"}</b>님</span>
        <span className="muted"> · </span>
        <span>{session.user?.email || "간편로그인"}</span>
        {profile?.complete && <><span className="muted"> · </span><span>{profile.gender === "m" ? "남" : "여"} · {ageBand(profile.birthDate!)} · {profile.sido}</span></>}
        <span className="muted"> · </span><Link href="/profile">{profile?.complete ? "프로필 수정" : "프로필 채우기"}</Link>
        {referral.invited > 0 && <><span className="muted"> · </span><span>초대한 친구 <b>{referral.invited}</b>명</span></>}
      </div>
      {profile && !profile.complete && (
        <p className="form-error" style={{ marginTop: 10 }}>성별·생년월일·사는 곳이 아직 없습니다. <Link href="/profile">프로필 채우기 →</Link></p>
      )}

      <TriedCard items={tried} />

      <ul className="tabs">
        {SAVED_KINDS.map((k) => (
          <li key={k}>
            <Link href={`/my?tab=${k}`} className={k === tab ? "on" : ""}>
              {KIND_LABEL[k]}<span className="cnt">{count(k)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {!current.length && (
        <div className="box">
          <b>아직 저장한 {KIND_LABEL[tab]}이 없습니다.</b>
          <p className="small muted" style={{ marginTop: 6 }}>
            {tab === "place" ? "음식 페이지에서 맛집을 찾아 하트를 누르면 여기에 모입니다." : `${KIND_LABEL[tab]} 페이지의 하트를 누르면 여기에 모입니다.`}
          </p>
          <div className="btns">
            {tab === "drink" && <Link className="btn p" href="/drinks">전통주 둘러보기</Link>}
            {tab !== "drink" && <Link className="btn f" href="/foods">음식으로 찾기</Link>}
          </div>
        </div>
      )}

      {tab === "drink" && !!current.length && (
        <ul className="grid">
          {current.map((r) => { const d = D[r.item_id]; if (!d) return null; return (
            <li key={r.item_id}>
              <Link href={`/drinks/${toSlug(d.name)}`}>
                <span className="n">{d.name}</span>
                <span className="s">{[d.category, d.region, `어울리는 음식 ${(byDrink[d.id] || []).length}`].filter(Boolean).join(" · ")}</span>
              </Link>
              <Heart kind="drink" id={d.id} name={d.name} />
            </li>
          ); })}
        </ul>
      )}

      {tab === "food" && !!current.length && (
        <ul className="grid">
          {current.map((r) => { const f = F[r.item_id]; if (!f) return null; return (
            <li key={r.item_id}>
              <Link href={`/foods/${toSlug(f.name)}`}>
                <span className="n">{f.name}</span>
                <span className="s">{[f.category, `어울리는 술 ${(byFood[f.id] || []).length}`].filter(Boolean).join(" · ")}</span>
              </Link>
              <Heart kind="food" id={f.id} name={f.name} />
            </li>
          ); })}
        </ul>
      )}

      <h2 style={{ marginTop: 26 }}>내가 추천한 페어링 <span className="muted small">{picks.length}건</span></h2>
      {!picks.length ? (
        <p className="small muted">전통주·음식 화면의 <b>🙌 추천하기</b> 버튼으로 "이 술엔 이 음식"을 남기면 여기에 모입니다. <Link href="/picks">회원 추천 보기 →</Link></p>
      ) : (
        <ul className="picks-list">
          {picks.map((p) => { const d = p.drink_id ? D[p.drink_id] : null, f = p.food_id ? F[p.food_id] : null; return (
            <li key={p.id}>
              <div className="pair">
                {d ? <Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link> : <span>{p.drink_raw}</span>}<span className="x">×</span>{f ? <Link href={`/foods/${toSlug(f.name)}`}>{f.name}</Link> : <span>{p.food_raw}</span>}
              </div>
              <div className="small muted" style={{ marginTop: 2 }}>{memberPickStatusText(p.status, p.n, p.likes)} · {p.created_at.slice(0, 10)}</div>
              {p.note && <p className="why" style={{ marginTop: 6 }}>“{p.note}”</p>}
            </li>
          ); })}
        </ul>
      )}

      {tab === "place" && !!current.length && (
        <ul className="places">
          {current.map((r) => {
            const m = r.meta || {};
            return (
              <li key={r.item_id} className="place">
                <div className="n">{m.name || "이름 없는 장소"}</div>
                <div className="s">{[m.category, m.address].filter(Boolean).join(" · ")}</div>
                {m.food && <div className="s">저장할 때 보던 음식 · {m.food}</div>}
                {m.url && <a className="lk" href={m.url} target="_blank" rel="noopener nofollow">카카오맵에서 보기 ↗</a>}
                {m.phone && <a className="lk" href={`tel:${m.phone.replace(/[^0-9+]/g, "")}`} style={{ marginLeft: 12 }}>전화 {m.phone}</a>}
                <Heart kind="place" id={r.item_id} name={m.name || "이 장소"} meta={m} />
              </li>
            );
          })}
        </ul>
      )}

      <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }} style={{ marginTop: 34 }}>
        <button type="submit" className="btn">로그아웃</button>
      </form>
      <p className="small muted" style={{ marginTop: 14 }}><Link href="/terms">이용약관</Link> · <Link href="/privacy"><b>개인정보처리방침</b></Link> · <Link href="/withdraw">회원 탈퇴</Link></p>
    </div>
  );
}
