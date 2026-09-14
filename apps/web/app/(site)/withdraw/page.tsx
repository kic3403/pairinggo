/** 회원 탈퇴 — 지워지는 것을 보여 주고 확인 체크 후 계정 삭제(lib/account.ts deleteAccount). 개인정보처리방침 3·8번 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { deleteAccount } from "@/lib/account";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "회원 탈퇴 | 페어링GO", robots: { index: false } };

export default async function WithdrawPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=%2Fwithdraw");
  const sp = await searchParams;

  async function withdraw(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) redirect("/login?next=%2Fwithdraw");
    if (formData.get("confirm") !== "on") redirect(`/withdraw?error=${encodeURIComponent("안내를 확인했다는 칸에 체크해 주세요.")}`);
    await deleteAccount(s.user.id);
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="wrap" style={{ maxWidth: 480 }}>
      <p className="crumb"><Link href="/my">마이페이지</Link></p>
      <h1>회원 탈퇴</h1>
      <p className="lead">탈퇴하면 아래 정보가 바로 지워지고 되돌릴 수 없습니다.</p>
      <div className="box">
        <ul className="legal-list">
          <li>계정 정보 — 이메일·닉네임·성별·생년월일·사는 곳</li>
          <li>저장한 전통주·음식·음식점</li>
          <li>먹어봤어요 평가, 누른 하트</li>
          <li>올린 회원 추천 글과 사진, 페어링 카드에 실린 한 줄 글과 닉네임</li>
        </ul>
        <p className="small muted" style={{ margin: "8px 0 0" }}>검색·방문 기록은 회원과의 연결을 끊어 누구 것인지 알 수 없는 통계로만 남습니다.</p>
      </div>
      {sp.error && <p className="form-error">{sp.error}</p>}
      <form action={withdraw}>
        <label className="consent-row" style={{ margin: "6px 0 14px" }}>
          <input type="checkbox" name="confirm" required />
          <span>위 안내를 확인했고, 탈퇴합니다</span>
        </label>
        <div className="btns" style={{ marginTop: 0 }}>
          <button type="submit" className="btn danger">탈퇴하기</button>
          <Link href="/my" className="btn">취소</Link>
        </div>
      </form>
    </div>
  );
}
