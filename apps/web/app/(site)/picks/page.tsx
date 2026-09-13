/** 회원 추천 페어링 — 회원 여러 명이 겹쳐 추천한 조합(공개 기준 이상). 홈 아이콘 메뉴에서 들어온다. */
import type { Metadata } from "next";
import Link from "next/link";
import { D, F, MEMBER_PICK_MIN, memberPickSummary, toSlug } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { listPublicPicks } from "@/lib/member-picks";
import MemberPickCompose from "../_components/MemberPickCompose";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "회원 추천 페어링 | 페어링GO", description: "페어링GO 회원들이 직접 먹어 보고 추천한 전통주와 음식 조합입니다." };

export default async function PicksPage() {
  const c = await getCatalog();
  const picks = await listPublicPicks(60);
  const drinks = c.dataset.drinks.map((d) => ({ id: d.id, name: d.name })), foods = c.dataset.foods.map((f) => ({ id: f.id, name: f.name }));
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>회원 추천 페어링</h1>
      <p className="lead">회원이 "이 술엔 이 음식"을 추천하면, 같은 조합을 {MEMBER_PICK_MIN}명 이상 추천했을 때 여기에 올라옵니다. 닉네임과 한 줄 이유, 사진 한 장만 보여 드려요.</p>
      <MemberPickCompose drinks={drinks} foods={foods} />
      <p className="small muted">술·음식 화면의 🙌 추천하기 버튼으로도 남길 수 있어요. 카탈로그에 없는 술·음식은 확인한 뒤 게시됩니다.</p>
      {!picks.length ? (
        <p className="muted" style={{ marginTop: 18 }}>아직 공개된 회원 추천이 없어요. 위 버튼으로 첫 추천을 남겨 보세요.</p>
      ) : (
        <ul className="picks-list" style={{ marginTop: 18 }}>
          {picks.map((p) => {
            const d = D[p.d], f = F[p.f];
            if (!d || !f) return null;
            const photo = p.notes.find((n) => n.image);
            return (
              <li key={`${p.d}|${p.f}`}>
                <div className="pair"><Link href={`/drinks/${toSlug(d.name)}`}>{d.name}</Link><span className="x">×</span><Link href={`/foods/${toSlug(f.name)}`}>{f.name}</Link></div>
                <div className="small muted" style={{ marginTop: 2 }}>{d.category} · {d.region} · {memberPickSummary(p.n)}</div>
                {p.notes.filter((n) => n.note).slice(0, 2).map((n, i) => <p key={i} className="why" style={{ marginTop: 6 }}>“{n.note}” <span className="muted">— {n.nick}</span></p>)}
                {photo?.image && <a href={photo.image} target="_blank" rel="noopener noreferrer" className="mpick-photo" style={{ display: "inline-block", marginTop: 8 }}><img src={photo.image} alt={`${photo.nick}님의 사진`} loading="lazy" /></a>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
