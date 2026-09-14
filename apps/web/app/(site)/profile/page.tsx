/**
 * 프로필 — 닉네임·성별·생년월일·사는 곳. 소셜 로그인 회원은 여기서 채우고, 이메일 회원은 가입 때 채운 값을 고친다.
 * 가입 마무리가 필요하면(약관 동의 전·옛 버전, 닉네임 없음) SavedProvider가 여기로 보낸다.
 *  · 동의가 필요하면 "가입 마무리" — 약관 동의 + "동의하지 않고 나가기"(계정 연결 정보 삭제)
 *  · 닉네임만 없으면(간편가입에서 닉네임 동의를 끈 경우) 프로필 화면에서 닉네임을 정하게 한다
 */
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { birthDigitsToDate, consentFromForm, consentProblem, profileProblem, type Gender, type Sido } from "@pairinggo/shared";
import { auth, signOut } from "@/auth";
import { consentNeeded, deleteAccount, getProfile, recordConsent, setReferrer, updateProfile } from "@/lib/account";
import ConsentFields from "../_components/ConsentFields";
import Terms from "../_components/legal/Terms";
import { PrivacyConsentSummary } from "../_components/legal/PrivacyPolicy";
import NicknameField from "../_components/NicknameField";
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
    const back = (msg: string) => redirect(`/profile?error=${encodeURIComponent(msg)}&next=${encodeURIComponent(to)}`);
    const needConsent = await consentNeeded(s.user.id);
    const bad = profileProblem(input) ?? (needConsent ? consentProblem(consentFromForm((k) => formData.get(k))) : null);
    if (bad) back(bad);
    const r = await updateProfile(s.user.id, { gender: input.gender as Gender, birthDate: input.birthDate, sido: input.sido as Sido }, String(formData.get("nickname") ?? ""));
    if (!r.ok) back(r.error);
    // 추천인(가입 마무리 때만, 선택) — 못 찾으면 알려 주고 멈춘다(오타 확인)
    const referrer = String(formData.get("referrer") ?? "").trim();
    if (needConsent && referrer) { const rr = await setReferrer(s.user.id, referrer); if (!rr.ok) back(rr.error); }
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
  const needNick = !!p?.nicknameNeeded;
  return (
    <div className="wrap" style={{ maxWidth: 420 }}>
      {!finishing && <p className="crumb"><Link href="/my">마이페이지</Link></p>}
      <h1>{finishing ? "가입 마무리" : "프로필"}</h1>
      <p className="lead">{finishing ? "약관에 동의하고 프로필을 채우면 가입이 끝납니다. " : ""}성별·연령대·지역은 어떤 페어링이 인기인지 보는 통계에만 쓰고, 개인을 식별하는 용도로 쓰지 않습니다. 다른 회원에게는 닉네임만 보입니다.</p>
      {!finishing && needNick && !sp.error && <p className="form-error">회원 추천 글에 보일 닉네임을 정해 주세요.</p>}
      {sp.error && <p className="form-error">{sp.error}</p>}
      {sp.ok && <p className="form-ok">저장했습니다.</p>}
      <form action={save} style={{ marginTop: 18 }}>
        <input type="hidden" name="next" value={next} />
        <NicknameField defaultValue={p?.name} missing={needNick} />
        <ProfileFields gender={p?.gender} birthDate={p?.birthDate} sido={p?.sido} />
        {finishing && <label className="field"><span>추천인 닉네임 <span className="muted" style={{ fontWeight: 400 }}>선택 · 소개해 준 회원의 닉네임</span></span><input name="referrer" type="text" maxLength={24} placeholder="예: 막걸리러버" autoComplete="off" /></label>}
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
