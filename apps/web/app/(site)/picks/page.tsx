/** 회원 추천 페어링 — 회원이 올린 "이 술엔 이 음식" 글이 바로 보이고, 하트 많은 순으로 선다. 홈 아이콘 메뉴에서 들어온다. */
import type { Metadata } from "next";
import Link from "next/link";
import { MEMBER_PICK_LIKES_MIN, MEMBER_PICK_MIN } from "@pairinggo/shared";
import { getCatalog } from "@/lib/catalog";
import { listPosts } from "@/lib/member-picks";
import MemberPickCompose from "../_components/MemberPickCompose";
import PickFeed from "../_components/PickFeed";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "회원 추천 페어링 | 페어링GO", description: "페어링GO 회원들이 직접 먹어 보고 추천한 전통주와 음식 조합입니다." };

export default async function PicksPage() {
  const c = await getCatalog();
  const posts = await listPosts(100);
  const drinks = c.dataset.drinks.map((d) => ({ id: d.id, name: d.name })), foods = c.dataset.foods.map((f) => ({ id: f.id, name: f.name }));
  return (
    <div className="wrap">
      <p className="crumb"><Link href="/">홈</Link></p>
      <h1>회원 추천 페어링 <span className="muted">· {posts.length}건</span></h1>
      <p className="lead">회원이 올린 "이 술엔 이 음식" 글입니다. 공감하면 ♥를 눌러 주세요. 하트 많은 순으로 보이고, 하트 {MEMBER_PICK_LIKES_MIN}개를 받거나 같은 조합 글이 {MEMBER_PICK_MIN}개 모이면 술·음식 화면의 페어링 카드에도 올라갑니다.</p>
      <MemberPickCompose drinks={drinks} foods={foods} />
      <p className="small muted">술·음식 화면의 🙌 추천하기 버튼으로도 남길 수 있어요. 카탈로그에 없는 술·음식은 확인한 뒤 게시됩니다. 닉네임만 표시돼요.</p>
      {!posts.length ? <p className="muted" style={{ marginTop: 18 }}>아직 올라온 추천이 없어요. 위 버튼으로 첫 추천을 남겨 보세요.</p> : <div style={{ marginTop: 18 }}><PickFeed posts={posts} /></div>}
    </div>
  );
}
