/**
 * 프로필 — 성별·생년월일·사는 곳. 소셜 로그인 회원은 여기서 채우고, 이메일 회원은 가입 때 채운 값을 고친다.
 * 동의 기록이 없거나 옛 버전이면(간편가입 직후·약관 변경) "가입 마무리"로 약관 동의를 함께 받는다 — SavedProvider가 여기로 보낸다.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { birthDigitsToDate, consentFromForm, consentProblem, profileProblem, type Gender, type Sido } from "@pairinggo/shared";
import { auth, signOut } from "@/auth";
import { consentNeeded, deleteAccount, getProfile, recordConsent, updateProfile } from "@/lib/account";
import ConsentFields from "../_components/ConsentFields";
import Terms from "../_components/legal/Terms";
import { PrivacyConsentSummary } from "../_components/legal/PrivacyPolicy";
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
    const input = { gender: String(formData.get("gender") ?? ""), birthDate: birthDigitsToDate(String(formData.get("birthDate") ?? "")) ?? "", sido: String(formData.get("sido") ?? "") };
    const to = safeNext(String(formData.get("next") ?? ""));
    const needConsent = await consentNeeded(s.user.id);
    const bad = profileProblem(input) ?? (needConsent ? consentProblem(consentFromForm((k) => formData.get(k))) : null);
    if (bad) redirect(`/profile?error=${encodeURIComponent(bad)}&next=${encodeURIComponent(to)}`);
    await updateProfile(s.user.id, { gender: input.gender as Gender, birthDate: input.birthDate, sido: input.sido as Sido });
    if (needConsent) await recordConsent(s.user.id);
    redirect(to === "/profile" ? "/profile?ok=1" : to);
  }

  // 동의하지 않으면 간편가입으로 만들어진 계정 연결 정보를 바로 지운다(개인정보처리방침 3번)
  async function decline() {
    "use server";
    const s = await auth();
    if (s?.user?.id && (await consentNeeded(s.user.id))) await deleteAccount(s.user.id);
    await signOut({ redirectTo: "/" });
  }

  const finishing = !!p?.consentNeeded;
  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      {!finishing && <p className="crumb"><Link href="/my">마이페이지</Link></p>}
      <h1>{finishing ? "가입 마무리" : "프로필"}</h1>
      <p className="lead">{finishing ? "약관에 동의하고 프로필을 채우면 가입이 끝납니다. " : ""}성별·연령대·지역별로 어떤 페어링이 인기인지 보기 위해 받습니다. 개인을 식별하는 용도로 쓰지 않습니다.</p>
      {sp.error && <p className="form-error">{sp.error}</p>}
      {sp.ok && <p className="form-ok">저장했습니다.</p>}
      <form action={save} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <ProfileFields gender={p?.gender} birthDate={p?.birthDate} sido={p?.sido} />
        {finishing && <ConsentFields details={{ terms: <Terms />, privacy: <PrivacyConsentSummary /> }} />}
        <button type="submit" className="btn p" style={{ width: "100%" }}>{finishing ? "동의하고 가입 마치기" : "저장"}</button>
      </form>
      {finishing && (
        <form action={decline} style={{ marginTop: 10 }}>
          <button type="submit" className="btn" style={{ width: "100%" }}>동의하지 않고 나가기</button>
          <p className="small muted" style={{ marginTop: 6 }}>연결된 계정 정보를 바로 지우고 로그아웃합니다. 가입하지 않아도 검색과 페어링 보기는 그대로 쓸 수 있어요.</p>
        </form>
      )}
      <p className="small muted" style={{ marginTop: 18 }}><Link href="/terms">이용약관</Link> · <Link href="/privacy"><b>개인정보처리방침</b></Link></p>
    </div>
  );
}
