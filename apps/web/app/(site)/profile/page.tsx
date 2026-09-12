/** 프로필 — 성별·생년월일·사는 곳. 소셜 로그인 회원은 여기서 채우고, 이메일 회원은 가입 때 채운 값을 고친다. */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { profileProblem, type Gender, type Sido } from "@pairinggo/shared";
import { auth } from "@/auth";
import { getProfile, updateProfile } from "@/lib/account";
import ProfileFields from "../_components/ProfileFields";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "프로필 | 페어링GO", robots: { index: false } };

const safeNext = (v?: string) => (v && v.startsWith("/") && !v.startsWith("//") ? v : "/my");

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; ok?: string }> }) {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) redirect("/login?next=%2Fprofile");
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const p = await getProfile(uid);

  async function save(formData: FormData) {
    "use server";
    const s = await auth();
    if (!s?.user?.id) redirect("/login?next=%2Fprofile");
    const input = { gender: String(formData.get("gender") ?? ""), birthDate: String(formData.get("birthDate") ?? ""), sido: String(formData.get("sido") ?? "") };
    const to = safeNext(String(formData.get("next") ?? ""));
    const bad = profileProblem(input);
    if (bad) redirect(`/profile?error=${encodeURIComponent(bad)}&next=${encodeURIComponent(to)}`);
    await updateProfile(s.user.id, { gender: input.gender as Gender, birthDate: input.birthDate, sido: input.sido as Sido });
    redirect(to === "/profile" ? "/profile?ok=1" : to);
  }

  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      <p className="crumb"><Link href="/my">마이페이지</Link></p>
      <h1>프로필</h1>
      <p className="lead">성별·연령대·지역별로 어떤 페어링이 인기인지 보기 위해 받습니다. 개인을 식별하는 용도로 쓰지 않습니다.</p>
      {sp.error && <p className="form-error">{sp.error}</p>}
      {sp.ok && <p className="form-ok">저장했습니다.</p>}
      <form action={save} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <ProfileFields gender={p?.gender} birthDate={p?.birthDate} sido={p?.sido} />
        <button type="submit" className="btn p" style={{ width: "100%" }}>저장</button>
      </form>
    </div>
  );
}
